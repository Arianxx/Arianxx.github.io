---
title: 值得夸耀的 bottle 微框架源代码之剖析
date: 2018-11-27 20:54:21
tags: 
    - python
    - 源码
categories: python
---
>在这片天空中张开双翼

>自在地飞翔啊

bottle 是一个快速、简单、轻量的 web 框架，它以一个单文件的形式发布，并且不依赖 python 标准库以外的任何库。bottle 为使用者提供了诸多便利，如：

- 支持将动态 url 的请求映射到函数调用。
- 提供了一个简单的内置模板引擎，同时能够十分容易的替换为流行的 Mako、Jinja 等引擎。
- 同时提供了如文件上传、cookie读取等的实用工具。
- 并且内建了对许多常用兼容 python wsgi 规范的服务器的支持。

值得称道的是，bottle 主要文件只有不到 5000 行的代码。小巧、精简，却五脏俱全，被运用于诸多生成环境。

本文将简要剖析尚未发布的 bottle 0.12.14 版的最新 [commit](https://github.com/bottlepy/bottle/commit/9fb3b05846b33e508545a26e424785e151d02323) 版本。

<!--MORE-->

注意，本文中的所有代码片段都只显示出了核心逻辑部分，省略了部分与我们的剖析无关的代码。

## 路由
先从 hello, world 开始：
```python
from bottle import Bottle

app = Bottle()

@app.route('/hello/<name>')
def index(name):
    return app.template('<b>Hello {{name}}</b>!', name=name)

app.run(host='localhost', port=8080)
```

首先关注里面的路由注册部分，route 的源码：
```python
def route(self, path=None, method='GET', callback=None, **config):
    def decorator(callback):
        for verb in makelist(method):
            verb = verb.upper()
            route = Route(self, rule, verb, callback, **config)
            self.add_route(route)
        return callback

    return decorator(callback) if callback else decorator
```
最后一行的`return decorator(callback) if callback else decorator`使得本函数既能像正常函数，又能像装饰器那样调用。除此之外，我们通过传入的信息生成了 Route 的实例，并传入生成的实例调用了`add_route`。 

我们看到`add_route` 方法实际上将生成的 `route` 实例注册到本应用上：
```python
def add_route(self, route):
    self.routes.append(route)
    self.router.add(route.rule, route.method, route, name=route.name)
```
这里 `self.routes` 是一个收集了`route` 实例的列表，而 `self.router` 属性实际上是 `Router` 类的实例：
```python
class Bottle:
    def __init__(self, *args, **kwargs):
        ...
        self.routes = []
        self.router = Router()
        ...
```
所以，注册路由，实际上就是根据给定的路由信息（映射的地址、方法、要调用的函数等）生成 `Route` 的实例，并将其收集到应用实例的 `routes` 属性，并注册到一个 `Router` 实例中。

这里，`Route` 可以简单理解为将我们提供的各种信息整合到一起的类，实际的路由逻辑则由关键的 `Router` 类来完成。因此，我们看看 `Router` 究竟能做什么。首先查看 `add` 方法：
```python
def __init__(self, strict=False):
    ...
    self._groups = {}  # index of regexes to find them in dyna_routes
    self.dyna_routes = {}
    self.filters = {
        're': lambda conf: (_re_flatten(conf or self.default_pattern),
                            None, None),
        'int': lambda conf: (r'-?\d+', int, lambda x: str(int(x))),
        'float': lambda conf: (r'-?[\d.]+', float, lambda x: str(float(x))),
        'path': lambda conf: (r'.+?', None, None)
    }

def add(self, rule, method, target, name=None):
    """ Add a new rule or replace the target for an existing rule. """
    pattern = ''  # Regular expression pattern with named groups
    filters = []  # Lists of wildcard input filters
    builder = []  # Data structure for the URL builder

    # _itertokens 通过一个正则表达式将动态 url 里面的参数信息提取出来
    # 如 /user/<name:re:.*>，key 为 name, mode 为 re, conf 为 .*
    # 对于没有参数的部分， key 就为那段 url，如 '/user'，mode 和 conf 为空
    # 因此，这段循环的用意就是提却出 rule 里面的参数信息，收集它的 filter，
    # 并由此构建出一个用来匹配路径的正则表达式
    for key, mode, conf in self._itertokens(rule):
        if mode:
            mask, in_filter, out_filter = self.filters[mode](conf)
            pattern += '(?P<%s>%s)' % (key, mask)
            if in_filter: filters.append((key, in_filter))
        elif key:
            pattern += re.escape(key)

    re_pattern = re.compile('^(%s)$' % pattern)
    re_match = re_pattern.match

    def getargs(path):
        url_args = re_match(path).groupdict()
        # 根据 filter 过滤参数
        for name, wildcard_filter in filters:
            try:
                url_args[name] = wildcard_filter(url_args[name])
            except ValueError:
                raise HTTPError(400, 'Path has wrong format.')
        return url_args

    # _re_flatten 将正则表达式里面的捕获组转换为非捕获组
    flatpat = _re_flatten(pattern)
    whole_rule = (rule, flatpat, target, getargs)

    self.dyna_routes.setdefault(method, []).append(whole_rule)
    self._groups[flatpat, method] = len(self.dyna_routes[method]) - 1

    self._compile(method)
```

可见，`add` 方法主要是检查了提供的 rule，并从中提取出了动态路由所需的参数信息，根据给定的 rule，生成一个用来匹配路径的正则表达式。这里将与此次路由相关的信息收集到 `self.dyna_routes` 里面，将用来匹配的正则表达式收集到 `self._groups` 里面。在最后，调用了 `self._compile(method)` ：
```python
def _compile(self, method):
    all_rules = self.dyna_routes[method]
    comborules = self.dyna_regexes[method] = []
    combined = (flatpat for (_, flatpat, _, _) in all_rules)
    combined = '|'.join('(^%s$)' % flatpat for flatpat in combined)
    combined = re.compile(combined).match
    rules = [(target, getargs) for (_, _, target, getargs) in all_rules]
    comborules.append((combined, rules))
```

每次 `self.add` 一个新的路由信息，就会根据我们指定的与路由对应的 `method` 调用一次 `_compile`。而 `_compile` 里面，则清空 `self.dyna_regexes[method]`，并添加进根据我们在 `self.add` 里面修改了的 `self.dyna_routes[method]`，拼接的一个新的、由 `|` 连接起不同路由的正则表达式。

到此处我们已经可以窥见 bottle 映射路由的方式：每个方法的每个路由，都有一个独一无二的正则表达式能用来匹配路径并从中提取参数；每次添加路由，都将这个方法所对应的所有路由的正则表达式与这个方法的所有其它路由的正则表达式通过 `|` 拼接在一起；这样，以后每次请求时，只要根据所请求的方法使路径匹配这个巨大的正则表达式，就能够找出我们所需要的唯一信息。

为了印证我们的想法，我们查看 `Router` 类暴露出来匹配路径的方法 `match`:
```python
def match(self, environ):
    """ Return a (target, url_args) tuple or raise HTTPError(400/404/405). """
    verb = environ['REQUEST_METHOD'].upper()
    path = environ['PATH_INFO'] or '/'

    for method in methods:
        for combined, rules in self.dyna_regexes[method]:
            match = combined(path)
            if match:
                target, getargs = rules[match.lastindex - 1]
                return target, getargs(path) if getargs else {}
```
注意到此处`combined`中由`|`连接起来的捕获组与`rules`的一一对应关系，这个关系由`add`与前面的`_compile`方法共同确保。这里，返回的`target`是实际要映射的可调用对象，`getargs(path)`则是动态路由指定的参数。

## WSGI
上一节中我们检查了 bottle 中对路由注册处理，此节我们关注 bottle 究竟怎样实现其 wsgi 应用部分的。这样，我们就知道在背后，bottle 处理请求的整个大概流程。

首先关注`Bottle`类的 `__call__` 方法：
```python
    def __call__(self, environ, start_response):
        """ Each instance of :class:'Bottle' is a WSGI application. """
        return self.wsgi(environ, start_response)
```
简单转发给了`self.wsgi`:
```python
def wsgi(self, environ, start_response):
    """ The bottle WSGI-interface. """
    out = self._cast(self._handle(environ))
    # rfc2616 section 4.3
    if response._status_code in (100, 101, 204, 304)\
    or environ['REQUEST_METHOD'] == 'HEAD':
        if hasattr(out, 'close'): out.close()
        out = []
    start_response(response._status_line, response.headerlist)
    return out
```
首先根据服务器提供的，包含了请求信息的`environ`字典，先后调用了`self._handle`和`self._cast`得出结果，再将`response`里面的 header 信息和 status 信息传递给了`start_response`，最后返回了`out`作为结果。注意到，如果状态码是 100、101、204、304，或者请求的方法为`HEAD`，那么根据 HTTP1.1 协议的标准，响应没有 body，因此将 out 设为空。

下面我们关注具体处理了请求的`self._handle`方法：
```python
def _handle(self, environ):
    request.bind(environ)
    response.bind()

    route, args = self.router.match(environ)
    out = route.call(**args)

    return out
```
注意到此处的`self.router.match`我们已经在上节提到过，其返回我们指定的可调用对象及从动态url中获得的参数。

根据指定的可调用对象获得`out`之后，会交给`self._cast`处理，将它转化为一个合法的响应对象：
```python
def _cast(self, out, peek=None):
    if not out:
        if 'Content-Length' not in response:
            response['Content-Length'] = 0
        return []
    # Join lists of byte or unicode strings. Mixed lists are NOT supported
    if isinstance(out, (tuple, list))\
    and isinstance(out[0], (bytes, unicode)):
        out = out[0][0:0].join(out)  # b'abc'[0:0] -> b''
    # Encode unicode strings
    if isinstance(out, unicode):
        out = out.encode(response.charset)
    # Byte Strings are just returned
    if isinstance(out, bytes):
        if 'Content-Length' not in response:
            response['Content-Length'] = len(out)
        return [out]
    
    ...
```

可以看出，一个请求进入 bottle 之后其会按顺序被以下方法处理：
`__call__（暴露的接口） -> wsgi(按照 wsgi 协议处理请求) -> _handle(将请求映射到我们指定的可调用对象并得到结果) -> _cast(将结果转换为合法的响应对象)`

## 请求和响应对象
bottle 不单只为我们做了映射请求的幕后工作，为了方便我们的开发，还提供了一系列实用工具。其中，至关重要的两个就是`request`和`response`对象。`request`对象为我们封装了请求的信息，`response`对象可以让我们方便的定制响应。值得注意的是，这两个对象，在 bottle 里面是线程安全的。也就是说，在多线程环境运行下，两个同时发生的请求对这两个对象的修改互不影响。bottle 怎么实现这一点的呢？关键是利用了`本地线程储存对象`。

所谓本地线程储存对象，就是说，我们可以实例化一个 `threading.local`。如果一个线程修改了这个实例上的属性，这个修改只有线程本身能够看到。具体可以查阅[官方文档](https://docs.python.org/3/library/threading.html#thread-local-data)

首先查看 `request` 的源码：
```python
request = LocalRequest()

class LocalRequest(BaseRequest):
    bind = BaseRequest.__init__
    environ = _local_property()

def _local_property():
    ls = threading.local()

    def fget(_):
        try:
            return ls.var
        except AttributeError:
            raise RuntimeError("Request context not initialized.")

    def fset(_, value):
        ls.var = value

    def fdel(_):
        del ls.var

    return property(fget, fset, fdel, 'Thread-local property')
```
这里`LocalRequest.environ`是一个本地线程线程储存对象的描述符，并且注意到`bind`方法实际上就是`BaseRequest`的`__init__`方法。联想起我们曾经在上面使用过`request.bind(environ)`这样的语句，可以得出，实际上我们在我们的视图函数里面的调用的`request`对象，都是根据本次请求的`environ`初始化了的线程本地变量，因此每个`request`会根据请求环境的不同而不同。

接下来我们关注`BaseRequest`类：
```python
class BaseRequest(object):
    __slots__ = ('environ', )

    def __init__(self, environ=None):
        self.environ = {} if environ is None else environ
        self.environ['bottle.request'] = self

    @property
    def path(self):
        return '/' + self.environ.get('PATH_INFO', '').lstrip('/')

    @property
    def method(self):
        return self.environ.get('REQUEST_METHOD', 'GET').upper()

    ...
```
初始化方法中将传入的`environ`绑定到了`self.environ`上，注意到在`_handle`方法中调用`bind`时`self.environ`已经是一个线程本地变量。`BaseRequest`存在诸多描述符封装了服务器提供的`environ`字典，方便我们获取信息，此处不一一列出来。

`response`对象在本地线程储存方面与`request`如出一辙，我们可以直接在`response`上赋值，告诉框架我们想要的响应状态或 header。

## 其它
#### DEBUG 模式下的自动重启机制
自动重启指，如果将 bottle 设置为在 DEBUG 模式下运行，那么，每当源代码有更改时，服务器将自动重启，以适应更改。本节我们考察 bottle 如何实现这一点。

我们直接查看`run`函数的部分源码：
```python
def run(...):
    if reloader and not os.environ.get('BOTTLE_CHILD'):
        import subprocess
        lockfile = None
        try:
            fd, lockfile = tempfile.mkstemp(prefix='bottle.', suffix='.lock')
            os.close(fd)  # We only need this file to exist. We never write to it
            while os.path.exists(lockfile):
                args = [sys.executable] + sys.argv
                environ = os.environ.copy()
                environ['BOTTLE_CHILD'] = 'true'
                environ['BOTTLE_LOCKFILE'] = lockfile
                p = subprocess.Popen(args, env=environ)
                while p.poll() is None:  # Busy wait...
                    os.utime(lockfile, None)  # I am alive!
                    time.sleep(interval)
                if p.poll() != 3:
                    if os.path.exists(lockfile): os.unlink(lockfile)
                    sys.exit(p.poll())
        except KeyboardInterrupt:
            pass
        finally:
            if os.path.exists(lockfile):
                os.unlink(lockfile)
        return

    ...
```
可以看到，如果设置了自动重启，那么在启动 bottle 主线程时并不会实际运行服务器，而是设置了一个用来标识是否会自动重启的环境变量，然后在又启动了一个子线程。

值得注意的是，这里通过轮询 `p.poll()` 查看子进程是否已经退出，并且检查返回的状态码。如果状态码为 3，那么就会重新启动子线程。如果子线程没有退出，那么就会更新创建的临时文件的时间。在后面我们会看到，这个临时文件用来检查主线程是否结束。

接下来我们查看`run`函数的剩余部分：
```python
def run(...):
    ...
    server = server_names.get(server)
    if reloader:
        lockfile = os.environ.get('BOTTLE_LOCKFILE')
        bgcheck = FileCheckerThread(lockfile, interval)
        with bgcheck:
            server.run(app)
        if bgcheck.status == 'reload':
            sys.exit(3)
    ...
```
关键在于`FileCheckerThread`这个上下文管理器。在上下文管理器退出后，会检查它的`status`状态，如果为`reload`，就以状态码 3 退出，前面说过，这个状态码会导致主线程重新启动一个实际运行服务的子线程。

我们审查`FileCheckerThread`实际做了什么：
```python
class FileCheckerThread(threading.Thread):
    """ Interrupt main-thread as soon as a changed module file is detected,
        the lockfile gets deleted or gets too old. """

    def __init__(self, lockfile, interval):
        threading.Thread.__init__(self)
        self.daemon = True
        self.lockfile, self.interval = lockfile, interval
        #: Is one of 'reload', 'error' or 'exit'
        self.status = None

    def run(self):
        exists = os.path.exists
        mtime = lambda p: os.stat(p).st_mtime
        files = dict()

        for module in list(sys.modules.values()):
            path = getattr(module, '__file__', '')
            if path[-4:] in ('.pyo', '.pyc'): path = path[:-1]
            if path and exists(path): files[path] = mtime(path)

        while not self.status:
            if not exists(self.lockfile)\
            or mtime(self.lockfile) < time.time() - self.interval - 5:
                self.status = 'error'
                thread.interrupt_main()
            for path, lmtime in list(files.items()):
                if not exists(path) or mtime(path) > lmtime:
                    self.status = 'reload'
                    thread.interrupt_main()
                    break
            time.sleep(self.interval)

    def __enter__(self):
        self.start()

    def __exit__(self, exc_type, *_):
        if not self.status: self.status = 'exit'  # silent exit
        self.join()
        return exc_type is not None and issubclass(exc_type, KeyboardInterrupt)
```
这个上下文管理器巧妙的与线程结合在了一起。它会开一个线程用来监视文件是否更改，或者是主线程是否已经退出，并且在上下文管理器退出(`__exit__`)时阻塞。注意，在上一段代码中它包裹的`server.run(app)`本身已经将原来的线程阻塞。这里，只有在有文件更改，或者是主线程退出时，它会调用`thread.interrupt_main()`在主线程弹出`KeyboardInterrupt`结束服务的运行，并且在`__exit__`中将这个异常捕获。

同时也注意到这里是通过轮询比较`sys.modules`中出现的文件的更新时间来判断文件是否被修改的。

#### 默认 app
可以不手动引入`Bottle`类创建一个 app，而是引入`route`、`run`等方法直接开始，例如官方文档中的示例：
```python
from bottle import route, run, template

@route('/hello/<name>')
def index(name):
    return template('<b>Hello {{name}}</b>!', name=name)

run(host='localhost', port=8080)
```
下面我们看看 bottle 是怎么处理这种情况的。我们查看直接引入的`route`源码：
```python
route = make_default_app_wrapper('route')


def make_default_app_wrapper(name):
    """ Return a callable that relays calls to the current default app. """

    @functools.wraps(getattr(Bottle, name))
    def wrapper(*a, **ka):
        return getattr(app(), name)(*a, **ka)

    return wrapper

apps = app = default_app = AppStack()
```

可以看到源码中已经又一个已经存在的`app`对象，我们导入的各个方法都是对这个对象上方法的代理。我们查看`AppStack`:
```python
class AppStack(list):
    """ A stack-like list. Calling it returns the head of the stack. """

    def __call__(self):
        """ Return the current default application. """
        return self.default

    def push(self, value=None):
        """ Add a new :class:`Bottle` instance to the stack """
        if not isinstance(value, Bottle):
            value = Bottle()
        self.append(value)
        return value
    new_app = push

    @property
    def default(self):
        try:
            return self[-1]
        except IndexError:
            return self.push()
```

可以看到实际上实现了一个储存应用实例的栈，并且当没有实例存在于栈中时，会自动新建一个。

## 结束
最近天气渐渐变得寒冷了呢:D

![](https://arian-blogs.oss-cn-beijing.aliyuncs.com/18-11-28/41629255.jpg)