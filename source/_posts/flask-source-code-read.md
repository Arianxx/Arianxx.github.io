---
title: Flask 源码的二三事
date: 2019-01-25 15:03:18
tags:
    - python
    - 源码
categories: python
---
本文将基于 Flask 1.1.dev ( [a74864](https://github.com/pallets/flask/commit/a74864ec229141784374f1998324d2cbac837295) )，分析 Flask 源码之中一些有趣并且值得关注的部分，包括 路由机制、请求流程、上下文管理 等等。

<!--MORE-->

## 路由机制
本节关注 Flask 的路由机制。首先还是先看下 Flask 的 hello world：
```python
from flask import Flask
app = Flask(__name__)

@app.route("/")
def hello():
    return "Hello World!" 
```

跟进 route 方法：
```python
def route(self, rule, **options):
    def decorator(f):
        endpoint = options.pop('endpoint', None)
        self.add_url_rule(rule, endpoint, f, **options)
        return f
    return decorator
```
可见 route 方法实际上根据给定的参数另外调用了 add_url_rule：
```python
def add_url_rule(self, rule, endpoint=None, view_func=None,
                 provide_automatic_options=None, **options):
    if endpoint is None:
        endpoint = view_func.__name__
    options['endpoint'] = endpoint
    methods = options.pop('methods', None)

    ...

    rule = self.url_rule_class(rule, methods=methods, **options)

    self.url_map.add(rule)
    # self.view_functions = {}
    self.view_functions[endpoint] = view_func
```
添加路由的逻辑最终由 add_url_rule 这个方法实现。它的参数里 rule 就是要匹配 url 的模式，endpoint 是这个视图的端点名，view_func 是我们定义的函数。默认情况下，endpoint 为函数的名字。我们根据这些信息调用了 self.url_rule_class 方法，并用其返回值作为参数调用了 self.url_map.add。最后，将 endpoint 作为键，我们定义的函数作为值，添加进了 self.view_functions 字典。

这里 self.url_rule_class 和 self.url_map 是什么呢？
```python
from werkzeug.routing import Map, Rule

class Flask:
    url_rule_class = Rule

    def __init__(...):
        self.url_map = Map()
        ...
```
可见，Flask 路由机制的核心是 Map 和 Rule 类，而这两个类都来自 Flask 高度依赖的 werkzeug 包。因此，想要明白 Flask 路由的原理，首先我们必须对 werkzeug 有一定了解。这里我们先看下 Map 和 Rule 的简单用法：
```python
# 来自 werkzeug docs
url_map = Map()
url_map.add(
    Rule('/<id>', endpoint='user')
    )

def dispatch_request(self, request):
   adapter = self.url_map.bind_to_environ(request.environ)
   try:
       endpoint, values = adapter.match()
       return getattr(self, 'on_' + endpoint)(request, **values)
   except HTTPException, e:
       return e
```
这里的 request.environ 中的 evniron 是 wsgi 应用中传入 \__call__ 方法的一个参数。

调用 Map.bind_to_environ，根据给定请求的 environ 字典，生成了一个 URLAdapter。然后，调用 adapter 上的 match 方法，就能够得到此次请求对应的端点名和对应 url 的参数。比如说，如果此次请求是 `http://localhost:5000/foo`，那么返回的 endpoint 和 values 就为：
```python
endpoint == 'user'
values == {"id": "foo"}
```

可见，这里 Rule 对应的是每一条之后需要匹配的 url 规则，Map 将这些规则收集起来，对应这些规则的映射。之后，当有请求来的时候，就绑定 environ 生成 adapter，并调用 match 得到匹配的端点和参数。

现在我们返回 Flask。前面我们在 Flask 应用的初始化过程中生成了 Map 的一个实例。之后的每一次使用 route，在默认情况下把函数名作为 endpoint，生成一个新的 Rule 对象。并将它添加进 Map 实例中。最后将 endpoint 和函数本身作为键值添加进字典。

Map 是通过遍历 Rule，并一一匹配正则表达式来匹配路由的。这点目前不详细叙述，日后在另一篇文章中讲下吧。

用户方面添加路由的流程大致是这样了。下面我们从处理请求的流程中看路由机制的另一个方面。

## 请求流程
本节关注 Flask wsgi 应用的实现。我们查看 Flask 类的 \__call__ 方法：
```python
class Flask:
    def __call__(self, environ, start_response):
        return self.wsgi_app(environ, start_response)

    def wsgi_app(self, environ, start_response):
        ...
        # 生成请求上下文
        ctx = self.request_context(environ)
        try:
            try:
                # 推入上下文栈
                ctx.push()
                # 分发路由
                response = self.full_dispatch_request()
            except Exception as e:
                error = e
                # 处理异常
                response = self.handle_exception(e)
                # 最终得到包含了返回信息的 werkzeug Response 实例，调用它完成请求。
            return response(environ, start_response)
        finally:
            # 这里 finally 语句会在 return 之前执行
            # 弹出请求上下文对象
            ctx.auto_pop(error)
        ...
```

这里 \__call__ 方法仅仅将逻辑交给了 wsig_app 方法。这样做的一个好处在于，如果之后要为整个应用添加中间件，就不用处理整个 Flask 实例，直接替换 wsgi_app 方法即可，不用担心实例中的大量配置被丢失或覆盖：
```python
from . import middleware, app

# 我们可以这样用：
app.wsgi_app = middleware(app.wsgi_app)
# 而不是:
app = middleware(app)
```

回到 wsgi_app 方法，可以看到 response 由 self.full_dispatch_request 生成：
```python
def full_dispatch_request(self):
    try:
        rv = self.dispatch_request()
    except Exception as e:
        rv = self.handle_user_exception(e)
    # 将视图函数返回的值转换为合法的 response
    return self.finalize_request(rv)
```

跟进 slef.dispatch_request:
```python
def dispatch_request(self):
    # 得到请求上下文栈顶的 request 对象
    req = _request_ctx_stack.top.request
    rule = req.url_rule
    return self.view_functions[rule.endpoint](**req.view_args)
```

注意到这里出现了上一节里面的 self.view_functions，它的键是视图的端点名，值是视图对应的函数。这里我们通过 rule.endpoint 和 req.view_args 调用了视图函数，说明此时我们已经通过请求相关的信息(environ)，匹配到了对应的 url 和参数。

调用我们储存在 self.view_functions 里的视图函数得到请求的返回值以后，就将它传给了 self.finalize_request，将之转化为一个合法的响应对象后返回。

然而，这里的问题是，我们明明没有显示调用 self.url_map.bind_to_environ 与 adapter.match，是怎样从 \_request_ctx_stack.top.request 里得到正确信息的呢？实际上，奥秘隐藏在 Flask 的请求上下文机制里。

## 请求上下文Ⅰ
用过 Flask 的同学一定对其 request 对象映像深刻。不像 django 等框架，在每个视图函数里，都需要传入一个 request 参数，在 Flask 中，可以直接使用从全局导入的 request 对象:
```python
from flask import request

from . import app

@app.route('/show')
def show():
    print(request.environ)
    return 'ok'
```

request 自动适配每一个来到的请求。我们看看 request 的真面目：
```python
from functools import partial
from werkzeug.local import LocalStack, LocalProxy

def _lookup_req_object(name):
    top = _request_ctx_stack.top
    if top is None:
        raise RuntimeError(_request_ctx_err_msg)
    return getattr(top, name)

_request_ctx_stack = LocalStack()
request = LocalProxy(partial(_lookup_req_object, 'request'))
```

这里一时间让我们不明所以。我们看到 \_request_ctx_stack 原来是 werkzeug 中 LocalStack 的实例（注意 \_request_ctx_stack 在上一节 dispatch_request 中出现过），request 是 LocalProxy 的实例。

#### LocalStack
为了理解这一段代码，我们需要先了解 LocalStack 的用法。简单来说，这里的 LocalStack 类似于 [线程本地变量](https://stackoverflow.com/questions/104983/what-is-thread-local-storage-in-python-and-why-do-i-need-it)，在一个的线程中修改它的值，对于其它线程来说是透明的。更具体的说，这里的 LocalStack 是一个 线程本地栈，在一个线程中给这个栈推入或弹出值，并不会影响其它线程中的 LocalStack。

LocalStack 的实现依赖于 werkzeug 中的 Local 类，我们先查看 Local 类的源码:
```python
from thread import get_ident

class Local(object):
    # 实例中只能修改 __storage__ 和 __ident_func__ 这两个属性
    # 节省内存空间
    __slots__ = ('__storage__', '__ident_func__')

    def __init__(self):
        # 因为本类已经有了 __setattr__ 方法，为了避免循环调用
        # 直接从 object.__setattr__ 给它的属性设置值
        object.__setattr__(self, '__storage__', {})
        # get_ident 得到每个线程的唯一 id
        object.__setattr__(self, '__ident_func__', get_ident)

    def __release_local__(self):
        # 释放线程本地变量
        self.__storage__.pop(self.__ident_func__(), None)

    def __getattr__(self, name):
        try:
            # self.__ident__func 获取线程 id
            # 得到 __storage__ 字典里对应本线程字典中键为 name 的值
            return self.__storage__[self.__ident_func__()][name]
        except KeyError:
            raise AttributeError(name)

    def __setattr__(self, name, value):
        """
        在这个实例上设置属性，会将它储存在本线程对应的字典里
        """
        # 线程 id
        ident = self.__ident_func__()
        storage = self.__storage__
        try:
            storage[ident][name] = value
        except KeyError:
            storage[ident] = {name: value}

    def __delattr__(self, name):
        """
        删除一个属性，删除本线程对应字典里的值
        """
        try:
            del self.__storage__[self.__ident_func__()][name]
        except KeyError:
            raise AttributeError(name)
```

Local 类的实例是一个线程本地变量。它在内部维护了一个 \__storage\__ 字典，这个字典的键为各线程的 id，值为字典，储存对应线程上设置的值。它通过 \__setattr\__ 等特殊方法，将属性访问转发给内部的 \__storage\__ 字典。这样，对于不同的线程，Local 的实例上储存的值是不同的。

注意到 Local 类中有一个 \__slots\__ 属性。这是一个特殊属性，拥有它的类的实例上不会有 \__dict\__ 字典，从而节省了内存空间。文档中说：
>The \__slots\__ declaration takes a sequence of instance variables and reserves just enough space in each instance to hold a value for each variable. Space is saved because \__dict\__ is not created for each instance.

相应的，拥有 \__slots\__ 的类，其实例也不被允许赋予 \__slots\__ 中规定外的属性。

还是让我们继续看 LocalStack 的源码吧：
```python
class LocalStack(object):
    def __init__(self):
        # 保存了上面 Local 的实例，一个线程本地变量。
        self._local = Local()

    def __release_local__(self):
        # 释放内部的线程本地变量
        self._local.__release_local__()

    def push(self, obj):
        """Pushes a new item to the stack"""
        rv = getattr(self._local, 'stack', None)
        if rv is None:
            # self._local 是线程本地变量。储存在它上面的属性会储存在其内部的 __storage__ 字典中
            # 这样，对于不同的线程来说，self._local.stack 这个栈也是不同的
            self._local.stack = rv = []
        rv.append(obj)
        return rv

    def pop(self):
        """Removes the topmost item from the stack, will return the
        old value or `None` if the stack was already empty.
        """
        stack = getattr(self._local, 'stack', None)
        if stack is None:
            return None
        elif len(stack) == 1:
            # 如果 stack 只剩最后一个，为节省内存，将内部的字典释放
            self.__release_local__()
            return stack[-1]
        else:
            # 否则弹出栈顶
            return stack.pop()

    @property
    def top(self):
        """The topmost item on the stack.  If the stack is empty,
        `None` is returned.
        """
        try:
            return self._local.stack[-1]
        except (AttributeError, IndexError):
            # 如果栈中还没有元素，不报错而是返回 None
            return None
```

结合前面的 LocalStack 看，Local 的用法就很明显了。它使用前面的线程本地变量，模仿了一个线程本地栈。与实际的栈不同的地方还在于，当栈为空时，不弹出异常，而是返回 None。同时，当弹出栈最后一个元素时，线程本地变量中维护的本地的字典将会被提前释放以节省内存空间。

现在我们了解 LocalStack 了，我们可以发现 \_request_ctx_stack 实际上就是 LocalStack 的实例，一个线程本地栈。实际上，\_request_ctx_stack 就是 Flask 中至关重要的**请求上下文栈**。当然，现在它仍然空空如也，只有当有也新的请求进入时，服务器会新建一个线程，然后使用上一节中的`ctx.push()`推入新的请求上下文。

#### LocalProxy
然而我们这里仍然没触及到我们最感兴趣的 request，它还与 LocalProxy 类相关：
```python
class LocalProxy(object):
    # 节省内存
    __slots__ = ('__local', '__dict__', '__name__', '__wrapped__')

    def __init__(self, local, name=None):
        # 它本身有 __setattr__，避免循环调用
        object.__setattr__(self, '_LocalProxy__local', local)
        object.__setattr__(self, '__name__', name)

    def _get_current_object(self):
        if not hasattr(self.__local, '__release_local__'):
            # 如果不是线程本地变量，作为函数调用并返回。
            # 例如，前面的 request ，传入的参数就不是直接的线程本地变量，而是一个 
            # partial 了的函数
            return self.__local()
        try:
            return getattr(self.__local, self.__name__)
        except AttributeError:
            raise RuntimeError('no object bound to %s' % self.__name__)

    @property
    def __dict__(self):
        try:
            # 转发给它代理的线程本地变量
            return self._get_current_object().__dict__
        except RuntimeError:
            raise AttributeError('__dict__')

    def __bool__(self):
        try:
            # 转发给它代理的线程本地变量
            return bool(self._get_current_object())
        except RuntimeError:
            return False

    # 它还有许多与上面两个方法相似的代理
    ...
```

LocalProxy 是一个有意思的类，结合前面我们给出的 `request = LocalProxy(partial(_lookup_req_object, 'request'))` 语句就会更有意思。它接受一个线程本地变量，然后将对它的实例的几乎所有访问，都会转发给那个线程本地变量上的指定属性。并且在那个属性不存在时弹出 RuntimeError 异常。

注意到它的 \__init\__ 方法中的 `object.__setattr__(self, '_LocalProxy__local', local)`语句。这里使用 object.\__setattr\__ 是为了避免循环调用，因为它自己也实现了 \__setattr\__ 方法（并将它转发给线程本地变量上的属性）。这里使用了 \_LocalProxy\__local 这个名称，然而在之后却直接以 \__local 访问。这是因为 \__local 是一个双下划线方法，在自身以外的类访问时，会被重命名。

前面我们提到过，\__slots\__ 特殊属性会删除实例的 \__dict\__ 字典，并以恒定空间储存实例属性，以节省内存。然而这里在 \__slots\__ 中，又加回了 \__dict\__ 方法。本来因为 \__slots\__ 的原因，将要删除的字典，这里又额外添加进来，这是不是有几分做无用功的意味？

实际上，这也是为了节省内存而做的努力。这里必须存在 \__dict\__ 原因，是因为 LocalProxy 也会将对自身的属性访问转发给其代理的对象，因此必须允许对 \__dict\__ 的访问。我们已经为了节省内存，在 \__slots\__ 中设定了 \__local、\__name\__ 等属性，这样，这些属性将会被存放在固定的空间中而非 \__dict\__。然而，没有 \__dict\__，尝试对实例赋其它值时，就会直接引起 AttributeError，使得我们无法对其作转发。因此，我们为其添加 \__dict__ 属性以重新允许对实例赋值。当然，此时所有赋值实际会被转发给其代理对象。

值得注意的是，即使重新规定了 \__dict\__，当对实例赋值时，规定在 \__slots\__ 中的其它属性，仍会被储存在固定空间而非 \__dict\__ 字典，从而 LocalProxy 实例上的 \__dict\__ 字典实际会一直为空。对线程本地变量的代理，以及 \__slots\__ 属性的优先级，两者一起使得实例虽然有 \__dict\__ 属性，却不会浪费使 \__slots\__ 失效的更多空间。

好，关于它的 \__slots\__ 的问题到此为止。我们需要知道这个类会将访问转发给线程本地变量上的一个属性。对于我们的 request 而言，我们传入了 `partial(_lookup_req_object, 'request')` 作为参数生成它。这里我们回顾一下 \_lookup_req_object 的源码：
```python
def _lookup_req_object(name):
    top = _request_ctx_stack.top
    if top is None:
        raise RuntimeError(_request_ctx_err_msg)
    return getattr(top, name)
```

它会查看栈顶是否有请求上下文，如果有，就返回想要的属性，否则弹出异常。结合 LocalProxy ，可以看出，实际上，**request一直是请求上下文栈顶的对象的”request"属性**。并且这个 request 对于各个请求来说是独立的。当请求上下文为空时，会弹出 RuntimeError。

## 请求上下文Ⅱ
现在我们了解到 request 是 \_request_ctx_stack 这个请求上下文栈的栈顶对象里面的 "request" 属性，但实际上虽然我们知晓了请求上下文栈的存在，却还不了解具体在这个上下文栈中储存了什么对象，因而不能理解它的实质。为了了解 request 的实质，我们回顾前面的请求流程。

前面提到过，Flask 也以 wsgi 的应用呈现。最后，Flask 的 app 实例会暴露出一个 \__call\__ 方法，给应用服务器访问。应用服务器会给 \__call\__ 方法传入代表请求上下文信息的 environ 字典，以及一个设置 response header 和 status 的 start_response 回调函数。

Flask 将 \__call\__ 方法转发给 wsgi_app 方法。注意到 wsig_app 方法中的 `ctx = self.request_context(environ)` 语句，以及之后的 `ctx.push()` 和最后的 `ctx.auto_pop(error)` 语句。实际上，就是这些语句将我们需要的对象都推入到了请求上下文栈中。

我们查看 self.request_context 的源码：
```python
from .ctx import RequestContext

def request_context(self, environ):
    return RequestContext(self, environ)
```

跟进 RequestContext:
```python
class RequestContext(object):
    def __init__(self, app, environ, request=None, session=None):
        self.app = app
        if request is None:
            request = app.request_class(environ)
        self.request = request
        self.url_adapter = None
        self.url_adapter = app.create_url_adapter(self.request)

        ...

        if self.url_adapter is not None:
            self.match_request()
    ...
```

默认情况下，又回调了 app 实例中的 app.request_class 和 app.create_url_adapter 。先看 app.request_class:
```python
from .wrappers import Request

class Flask:
    request_class = Request
```

这里的 Request 对象主要是 Flask 对于 werkzeug 里面 RequestBase 对象的封装。它接受一个 environ 字典，将储存在 environ 字典中的原始信息以各种方式封装后方便用户访问。

更重要的是 app.create_url_adapter:
```python
    def create_url_adapter(self, request):
        ...
        return self.url_map.bind_to_environ(
            request.environ)
```
饶了一个大圈子之后这里我们终于又回到了第一节路由机制里面的 self.url_map 对象。它是 werkzeug 里 Map 类的实例。根据我们前面介绍过的用法，这里绑定 environ 信息后会返回一个 adapter，调用 adapter 的 match 方法就能够得到匹配的端点名和参数。我们将 adapter 储存在了 RequestContext 的 url_adapter 属性中。

接下来看 RequestContext.match_request:
```python
def match_request(self):
    url_rule, self.request.view_args = \
        self.url_adapter.match(return_rule=True)
    self.request.url_rule = url_rule
```
这里终于调用了 self.url_adapter 的 match 函数。调用之后，我们就已经匹配到了分发这次请求需要的信息了。将它们储存在了 self.request.url_rule 和 self.request.view_args 中。

现在 RequestContext 已经初始化完毕了。之后在正式处理请求的 `response = self.full_dispatch_request()` 语句前，先调用了 `ctx.push()`：
```python
    def push(self):
        ...
        _request_ctx_stack.push(self)
```

这里再次出现了 \_request_ctx_stack，前面分析过的线程本地栈。我们将 RequestContext 的实例推入了栈。在请求结束之后，我们又会调用 ctx.auto_pop 把这个实例弹出栈。

现在我们能够了解我们从全局导入的 reqeust 对象的实质了。它就是 Flask.wrappers 中 Request 类的实例，绑定在 RequestContext 的实例上。在每一次请求中，都会新建一个请求上下文对象 RequestContext，在它的初始化过程中，会调用绑定在 app 上的 werkzeug 里的 Map 实例 url_map 匹配 url，得到参数，将它们作为 request 的 url_rule 和 view_args 属性。然后将这个请求上下文推入请求上下文栈。我们访问到的 request 对象，就是对这个请求上下文栈顶的请求上下文里面的那个 request 的代理。这样，对于每个不同的线程而言，这个 request 对象也就自动包含了相应的请求信息。

比如说，前面的 dispatch_request 中出现过这样的语句 `return self.view_functions[rule.endpoint](**req.view_args)`，这里的 rule.endpoint 和 req.view_args 就是从绑定完毕后的 request 对象里面获取的。

关于请求上下文，还有一点值得琢磨。每一次请求都会新建一个线程，这样，在一次请求的整个流程中，明明只需要将这个线程对应的请求上下文推入一次即可，为什么要用栈来实现请求上下文呢？这一点 Flask 的源码中曾经提到过：
>Because the contexts are stacks, other contexts may be pushed to change the proxies during a request. While this is not a common pattern, it can be used in advanced applications to, for example, do internal redirects or chain different applications together.

这样做是为了能够在多个不同的应用之间做内部重定向。虽然如此，Flask 尚没有提供与此相关的 api，可能为了以后保留的。在绝大多数的开发中，实际上请求上下文栈一直只会有最多一个上下文对象。

## 应用上下文
除了请求上下文之外，Flask 还存在应用上下文的概念。应用上下文随线程中第一次请求上下文的推入而创建，在前面的 `ctx.push` 方法中：
```python
def push(self):
    ...
    app_ctx = _app_ctx_stack.top
    if app_ctx is None or app_ctx.app != self.app:
        app_ctx = self.app.app_context()
        app_ctx.push()
    ...
```

这里的 \_app_ctx_stack，应用上下文栈，原理和请求上下文栈别无二致：
```python
_app_ctx_stack = LocalStack()
```

app_ctx.push 中，推入的是 AppContext 类的实例。这个类封装了应用的一些信息，不详细叙述了。

这里值得关注的是，为什么 Flask 除了请求上下文以外，还需要一个应用上下文的概念？在一次请求中，不是可以直接调用 RequestContext 上的 app 属性获得应用相关的信息吗？要理解这一点，需要先理解 Flask 多应用的存在。

我们可以通过 Flask 中的蓝图，将一个大的应用划分为几个子板块。但有时，这样还不够，我们需要几个子板块都拥有自己的配置信息与逻辑，成为几个单独的子系统。Flask 允许这一点，比如说，可以这样使用：
```python
# 来自 stackoverflow
from werkzeug.wsgi import DispatcherMiddleware
from frontend_app import application as frontend
from backend_app import application as backend

application = DispatcherMiddleware(frontend, {
    '/backend':     backend
})
```
这样，在一次请求对应的一个解释器线程中，可能会同时存在多个逻辑上分割的 Flask 应用。而 Flask 请求还恰恰赋予了我们使用 url_for 这样的全局函数直接获取一个应用中端点名对应的 url，这就需要保持每个应用的上下文，需要时从应用上下文栈中获取。

Flask 就借助于应用上下文实现了 current_app 这样的全局对象，帮助我们获取此次请求对应的应用信息：
```python
def _find_app():
    top = _app_ctx_stack.top
    if top is None:
        raise RuntimeError(_app_ctx_err_msg)
    return top.app

_app_ctx_stack = LocalStack()
current_app = LocalProxy(_find_app)
```
可以发现和 request 非常相似。