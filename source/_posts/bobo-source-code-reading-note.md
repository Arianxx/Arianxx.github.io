---
title: 深具传统的 bobo 微框架源代码之阅读
date: 2018-10-30 09:27:19
tags:
    - python
    - 源码
categories: python
---
>不做也行的事情就不做，非做不可的事情一切从简。

[bobo](https://github.com/zopefoundation/bobo) 是一个诞生于上世纪的，直到近两年仍然在更新的 python web 微框架。可以说深具传统，从侧面上见证了这么多年来 python 在 web 开发领域的种种发展。据说，正是这个框架将 fluend python 的作者 Luciano Ramalho 带入了 python 编程的生涯。

<!--MORE-->

bobo 框架的特殊之处在于，它是 python 里首个利用 python 强大的动态特性、面向对象特性，用短短一千多行的核心代码，将 url 直接映射到对象层次结构上，而不是使用传统的路由配置的框架。[bobo 文档](https://bobo.readthedocs.io/en/latest/) 里的 hello world例子如下：
```python
import bobo

@bobo.query('/')
def hello():
    return "Hello world!"
```
可以看到，这个例子和现在的知名框架 Bottle 和 Flask 十分相像。其实，Bottle 和 Flask 如今的 url 映射方式，可以说都是从 bobo 框架里受到的启发。

bobo 文档里提到，它主要提供了两个功能：

1. 将 url 映射到对象。
2. 调用对象生成HTTP响应。

本文将简要剖析 bobo 源代码，以理解它是怎么实现这两个功能的。

## 注册视图函数
### 底下的 _handler 函数
为了方便和直观起见，就让我们从上到下，先从我们直接接触的注册视图函数的部分开始，剖析 bobo 的代码吧。首先查看 query 方法的源码：
```python
def query(route=None, method=('GET', 'POST', 'HEAD'),
          content_type=_default_content_type, check=None, order=None):
    return _handler(route, method=method, params='params', check=check,
                    content_type=content_type, order_=order)
```
可见，query 方法只是简单将它的参数转发给了 \_handler 函数。实际上是 \_handler 函数在底下完成了 query 的功能。

无独有偶，我们可以查看 bobo 中与 query 对应的，其它几个注册视图的函数的源码，例如 post：
```python
def post(route=None, content_type=_default_content_type, check=None,
         order=None):
    return _handler(route, method="POST", params='POST', check=check,
                    content_type=content_type, order_=order)
```
可以发现，实际上 bobo 暴露出来的几个注册视图的函数，例如 get、post、query，都只是对 \_handler 函数的简单封装，为其提供了不同的参数。因此我们继续查看 \_handler 函数的源码：
```python
def _handler(route, func=None, **kw):
    if func is None:
        if route is None or isinstance(route, six.string_types):
            return lambda f: _handler(route, f, **kw)
        func = route
        route = None
    elif route is not None:
        assert isinstance(route, six.string_types)
        if route and not route.startswith('/'):
            raise ValueError("Non-empty routes must start with '/'.", route)

    return _Handler(route, func, **kw)
```
注意，2-6 行代码使得注册视图函数能够以多种方式调用，比如：
```python
@query
def hello():
    return "Hello world!"

@query()
def hello():
    return "Hello world!"

@query(None)
def hello():
    return "Hello world!"
```
三种调用方式是等同的。

### 生成的 _Handler 实例
最后，\_handler 将它的参数传递给了 \_Handler 类，再返回。因此，实际上最终我们声明的视图函数变成了 \_Handler 类的实例。下面我们再查看 \_Handler 的初始化方法的源码
```python
_ext_re = re.compile('/(\w+)').search
class _Handler:
    """
    省略了其它方法
    """
    partial = False

    def __init__(self, route, handler,
                 method=None, params=None, check=None, content_type=None,
                 order_=None):
        if route is None:
            route = '/'+handler.__name__
            ext = _ext_re(content_type)
            if ext:
                route += '.'+ext.group(1)
        self.bobo_route = route
        if isinstance(method, six.string_types):
            method = (method, )
        self.bobo_methods = method

        self.handler = handler
        self.bobo_original = getattr(handler, 'bobo_original', handler)
        bobo_sub_find = getattr(handler, 'bobo_response', None)
        if bobo_sub_find is not None:
            self.bobo_sub_find = bobo_sub_find

        self.content_type = content_type
        self.params = params
        self.check = check
        if order_ is None:
            # order() 返回一个始终增大的数字
            order_ = order()
        self.bobo_order = order_
```
可见，在 route 为 None 时，bobo 根据 handler 的名称和 content_type 的类型，自动为我们生成了 route。并且，我们传入的其它参数被绑定在了实例上。

#### 获取动态路由的信息
此外，\_Handler 类上有几个值得我们特别关注的方法，其中一个是 match:
```python
@_cached_property
def match(self):
    route_data = _compile_route(self.bobo_route, self.partial)
    methods = self.bobo_methods
    if methods is None:
        match = route_data
    else:
        def match(request, path, method):
            data = route_data(request, path)
            if data is not None:
                if method not in methods:
                    raise MethodNotAllowed(methods)
                return data

    self.__dict__['match'] = match
    return match
```

其中，\_cached_property 的源码如下：
```python
class _cached_property(object):
    def __init__(self, func):
        self.func = func

    def __get__(self, inst, class_):
        return self.func(inst)
```

match 方法的奇异之处在于，它巧用了描述符，在第一次被访问的时候根据我们传入的参数，生成另外的函数替换自己。真正的 match 函数根据 request 和 path 产生了 route data，如果 method 参数在我们传入的 methods 里，就返回 data，否则就抛出 MethodNotAllowed。这里我们关注产生了根据请求匹配路由函数的 \_compile_route 方法：
```python
route_re = re.compile(r'(/:[a-zA-Z]\w*\??)(\.[^/]+)?')
def _compile_route(route, partial=False):
    """
    生成根据给定路径解析对应路由，返回其中包含的关键字参数的函数
    """
    assert route.startswith('/') or not route
    # split 扫描整个字符串并将与模式匹配与否的部分相互分开
    # 并且匹配完整的模式一遍就会加一个 None 以分隔
    pat = route_re.split(route)
    # 反转以方便 pop
    pat.reverse()
    rpat = []
    prefix = pat.pop()
    # 静态前缀，如果没有会是一个空字符串
    if prefix:
        rpat.append(re.escape(prefix))
    while pat:
        name = pat.pop()[2:]
        optional = name.endswith('?')
        if optional:
            name = name[:-1]
        # 构造一个具名匹配组，匹配 / 以外的字符
        name = '/(?P<%s>[^/]*)' % name
        ext = pat.pop()
        if ext:
            name += re.escape(ext)
        if optional:
            # 如果这个路由可选择，则包围以可选择的匹配组
            name = '(%s)?' % name
        rpat.append(name)
        s = pat.pop()
        if s:
            # 静态后缀
            rpat.append(re.escape(s))

    if partial:
        # 如果提供了 partial，表明只匹配一部分路径
        match = re.compile(''.join(rpat)).match

        def partial_route_data(request, path, method=None):
            m = match(path)
            if m is None:
                return m
            path = path[len(m.group(0)):]
            # 那么返回关键字参数和剩余路径
            return (dict(item for item in six.iteritems(m.groupdict())
                         if item[1] is not None),
                    path,
                    )

        return partial_route_data
    else:
        # 没有partial，匹配到结尾
        match = re.compile(''.join(rpat)+'$').match

        def route_data(request, path, method=None):
            m = match(path)
            if m is None:
                return m
            # 直接返回对应参数
            return dict(item for item in six.iteritems(m.groupdict())
                        if item[1] is not None)

        return route_data
```
这个函数的意思是说，我们可以设置动态路由，然后获取其中动态部分的参数，比如：
```
@query('/people/:name')
```
\_compile_route 生成的 match 函数会返回动态路由参数组成的字典。

可见 bobo 通过正则匹配的方式实现了动态路由里面参数的获取。
#### 内省视图函数
\_Handler 类还有一个非常重要的，与 match 方法相似的方法:
```python
@_cached_property
def bobo_handle(self):
    func = original = self.bobo_original
    if self.params:
        func = _make_caller(func, self.params)
    func = _make_bobo_handle(func, original, self.check, self.content_type)
    self.__dict__['bobo_handle'] = func
    return func
```

这里主要用到了我们最初传入 \_Handler 的一些参数，调用了 \_make_caller 和 \_make_bobo_handle 产生了真正的 bobo_handle 方法。其中，\_make_caller 实际上内省了我们定义的视图函数，根据 match 获取的动态路由和 request 里面的信息，给我们的视图函数提供了参数。

现在我们关注 \_make_caller:
```python
_no_jget = {}.get
def _make_caller(obj, paramsattr):
    # getargspec = inspect.getargspec if six.PY2 else inspect.getfullargspec
    spec = getargspec(obj)
    nargs = nrequired = len(spec.args)
    if spec.defaults:
        nrequired -= len(spec.defaults)
    no_jget = _no_jget

    def bobo_apply(*pargs, **route):
        request = pargs[-1]
        pargs = pargs[:-1]  # () or (self, )
        params = getattr(request, paramsattr)
        rget = route.get
        pget = params.getall
        jget = 0
        kw = {}
        for index in range(len(pargs), nargs):
            name = spec.args[index]
            if name == 'bobo_request':
                kw[name] = request
                continue
            v = rget(name)
            if v is None:
                v = pget(name)
                if v:
                    if len(v) == 1:
                        v = v[0]
                else:
                    if jget == 0:
                        if request.content_type == 'application/json':
                            jget = request.json.get
                        else:
                            jget = no_jget
                    v = jget(name, request)
                    if v is request:
                        if index < nrequired:
                            raise MissingFormVariable(name)
                        continue

            kw[name] = v

        return obj(*pargs, **kw)

    return bobo_apply
```
这里，obj是我们定义的视图函数，paramsattr 实际上是我们传入给 \_Handler 的 params 参数，route 是上面 match 方法返回的动态路由里面的参数，pargs 是请求信息。request 为 webob 库为我们处理了的包含请求信息的对象。

关键之处在于我们使用了 getargspec 得到了我们视图函数参数信息，然后再通过不同渠道为我们的视图函数收集参数值，最后再调用它返回结果。

例如，如果我们的函数声明里面有名为"bobo_request"的参数，最终这个参数就会被传入 request 对象。或者我们使用了 post 函数注册视图，那么 paramsattr 就为 'POST'，从而通过
`params = getattr(request, paramsattr)`获取了 post 过来的信息，如果请求的的类型为`application/json`，那么会得到反序列化了的 json 信息。

值得注意的是，如果从各种渠道没能获得我们函数声明里必要的参数，就会抛出 `MissingFormVariable` 错误。

而 \_make_bobo_handle可以将我们的视图函数返回的值转换为一个合法的响应对象。

我们查看 \_make_bobo_handle 的源码:
```python
def _make_bobo_handle(func, original, check, content_type):
    """
    将 func 获得的结果转换为一个合法的 wsgi response 
    """
    def handle(*args, **route):
        if check is not None:
            # 如果装饰 handler 函数时提供了 check，则会
            # 尝试调用 check 函数，如果 check 返回了值
            # 就将这个值作为 response，否则调用被装饰函数
            # 可以用来做 authorization
            if len(args) == 1:
                # 被装饰的 handler 是否是一个类方法
                result = check(None, args[0], original)
            else:
                result = check(args[0], args[1], original)
            if result is not None:
                return result
        result = func(*args, **route)

        # 如果 result 是一个可调用对象
        # 就视 result 为一个可返回 wsgi response 的合法对象
        if hasattr(result, '__call__'):
            return result

        # 否则抛出异常转换 result
        raise BoboException(200, result, content_type)

    return handle
```
已经为每一句添加了注释，故这里不再解释。

#### 统一处理的 bobo_response 方法
现在我们能够获取动态路由的信息，能够根据这些信息为我们的视图函数提供值，那么，最终我们如何应该结合这些东西去调用我们的视图函数呢？\_Handler 类里面的 bobo_response 方法为我们提供了这个功能：
```python
def bobo_response(self, *args):
    request, path, method = args[-3:]
    route_data = self.match(request, path, method)
    if route_data is None:
        return self.bobo_sub_find(*args)
    return self.bobo_handle(*args[:-2], **route_data)
```
注意，bobo_sub_find 在 \__init__ 根据我们传入的参数确定，默认情况下是一个返回 None 的空方法。这里可以简单理解为，**如果路由不匹配，返回None。**

可见，实际上我们定义的视图函数最终被替换为 \_Handler 类的实例。这里，每个实例都具有 bobo_response 方法，这个方法里面为我们整合了获取动态路由和内省视图函数以得到参数信息的一些逻辑，从而可以根据请求的信息调用我们的视图函数得到响应对象。至于真正的请求信息，则由调用者（也就是我们稍后会提到的 wsgi app）传递给 bobo_response 作为参数（args）。

这样，虽然省略了实际代码之中一些更加细小的划分，但我们已经大概了解了注册视图函数的完整流程。 下面就让我们看看 bobo 的核心 wsgi 应用部分吧。

## bobo WSGI Application
### 什么是 WSGI
WSGI 是`Web Server Gateway Interface`的缩写，实际上是一套python web 应用程序和服务器交互的规范。

在早期，不同的python web框架产生的应用程序带有不同的接口，难以与不同的http 服务器兼容。因此，为了方便兼容，简化开发，就产生了 WSGI 标准。它前接 http 服务器，后接 python web 服务器，起到了一个统一接口的作用。

在 WSGI 的定义中，一个 web 应用程序至少需要是一个可调用的对象，并且接受指定的参数。为了理解这一点，我们可以看看最简单的 WSGI 应用程序的实现：
```python
def application(environ, start_response):
    start_response('200 OK', [('Content-Type', 'text/html')])
    return [b'Hello, web!']      
```
这里，具体的 environ 和 start_response 由 python web 应用服务器提供，我们暂不关心。我们需要了解的是，任何遵循 WSGI 的python web 框架，最终都需要提供像上面这个小例子一样的可调用对象，bobo 也不例外。因此，下面让我们聚焦于 bobo 怎样实现它的 wsgi 应用部分，以及怎样与我们注册的视图函数集合在一起。

### Application 类
bobo 通过实现了 \__call__ 方法的 Application 类，提供了 WSGI 兼容的应用程序。源码如下：
```python
class Application:
    """
    省略了其它方法
    """
    def __call__(self, environ, start_response):
        request = webob.Request(environ)
        if request.charset is None:
            request.charset = 'utf8'

        return self.bobo_response(request, request.path_info, request.method
                                  )(environ, start_response)
```
所以，最终 bobo 暴露给 python web 应用服务器的，应该是 Application 类的实例。注意，这里使用了 webob 库的 Request 方法，它能够根据我们提供的 environ，生成包含其中信息的 request 对象。

注意到最终我们是将 self.bobo_response 根据请求生成的可调用对象作为 WSGI 应用程序，调用并返回的。为了理解 self.bobo_response 方法，我们首先查看 Application 类的 \__init__ 方法：
```python
class Application:
    def __init__(self, DEFAULT=None, **config):
        # ...省略了许多无关代码
        bobo_resources = config.get('bobo_resources', '')
        self.handlers = [r.bobo_response for r in bobo_resources]
```
我们遍历了 bobo_resources 将 bobo_response 方法作为 handlers。

注意，这里的`bobo_response`在我们之前注册的视图函数里面最终生成的实例里面出现过。实际上，这里已经在提示我们，这里的 handlers 可以是我们定义视图函数里 bobo_response 方法的列表。也就是说，我们可以传入我们视图函数的列表作为类的具名参数'bobo_resources'，它将会被收集到 bobo WSGI 应用程序实例的 handlers 属性里面。

### 匹配路由
现在我们查看真正处理了请求的 self.bobo_response 是如何实现的：
```python
def bobo_response(self, request, path, method):
    # ...省略了无关代码
    allowed = set()
    for handler in self.handlers:
        try:
            response = handler(request, path, method)
        except MethodNotAllowed as exc:
            allowed.update(exc.allowed)
            continue
        if response is not None:
            return response
    if allowed:
        return self.method_not_allowed(request, method, allowed)
    return self.not_found(request, method)
```
可见，这里遍历了 handlers，除非有 handlers 返回非None值或抛出异常，就继续遍历直到遍历完抛出404。值得注意的是，在前面注册路由的地方讲到过，如果路由不匹配，handlers 会返回 None。所以，这里实际上是说找到匹配路由的 handlers，再调用它返回 response。

## 总结
本文简要剖析了 bobo 的核心代码，审查了 bobo 将 url 映射到视图函数的方式，以及怎样根据请求调用对象。

我们看到，bobo 通过装饰器将视图函数转化为内置的类，然后通过正则表达式以及参数内省等方法从HTTP请求为视图函数提供参数，并且暴露出一个统一的接口以方便上层调用。bobo 将这些注册的类收集到其创建的WSGI应用程序实例里面，然后遍历它们以找到一个路由匹配的函数，再传入相关信息，将这个函数的返回值作为响应。

需要注意的是，封装 WSGI 规范传入的 environ，及实际产生符合 WSGI 规范的响应的部分，bobo 框架没有涉及。相反，bobo 将这部分的逻辑交给了 webob 库。这部分的内容就以后再提吧。

![](https://arian-blogs.oss-cn-beijing.aliyuncs.com/18-10-30/39948029.jpg)