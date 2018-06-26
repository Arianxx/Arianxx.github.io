---
title: Flask常见扩展总结
date: 2018-04-13 13:01:43
tags: 
    - Python
    - Flask
categories: 笔记
---
## 前言
[Flask](http://flask.pocoo.org/)是一个用python编写的、基于[Werkzeug WSGI](http://werkzeug.pocoo.org/)和[Jinja2](http://jinja.pocoo.org/docs/2.10/)的轻量级Web应用框架。因为其相比于django等框架来说简洁的功能与架构，常常被称为"microframework"。然而，称Flask为微框架并不意味着它相比起其它框架来说功能更少——Flask拥有强大的可扩展性以及活跃的社区。开发者可以根据自身的需求，自由的选择扩展包来增强其功能。

合理的选择扩展包，将极大的减少开发时间，提高开发效率。下面，本文就将列举出Flask应用程序开发中的一些常用扩展，以便于参考和查询。

<!--MORE-->

## Flask-WTF
Flask-WTF将Flask和[WTForms](https://wtforms.readthedocs.io/en/stable/)做了简单集成，包含[CSRF](https://en.wikipedia.org/wiki/Cross-site_request_forgery)，文件上传，验证码服务等。

特点：
1. 集成WTForms
2. 使用CSRF token保证安全性
3. 全局CSRF防御
4. 支持验证码服务
5. 配合[Flask-Uploads](https://pythonhosted.org/Flask-Uploads/)运作的文件上传服务
6. 使用[Flask-Babel](http://pythonhosted.org/Flask-Babel/)支持国际化

Flask-WTF集成了WTForms，使用它，可以以面向对象语言中类的形式构建表单，简化了处理、验证表单所需操作，使表单设计与Flask其它部分统一。

文档：[Flask-WTF](https://flask-wtf.readthedocs.io/en/stable/)

## Flask-SQLAlchemy
Flask-SQLAlchemy为使用Flask开发的应用程序提供了[SQLAlchemy](http://www.sqlalchemy.org/)的支持。它支持0.8及以上版本的SQLAlchemy，旨在通过提供有用的默认值和额外的帮助来简化Flask中SQLAlchemy的使用，使完成常见的任务变得更简单。

SQLAlchemy为python提供了[ORM](https://en.wikipedia.org/wiki/Orm)(对象关系映射)。简单地说，ORM就是为操作不同数据库提供了一个用面向对象思想设计的统一上层接口，隐藏了在具体语言中真实操作、连接数据库的底层实现，从而解耦了应用和数据库，使得方便的更换数据库成为可能。（但同样，正因如此，ORM往往不能覆盖各数据库的特有功能）。通过Flask-SQLAlchemy，可以方便的在Flask使用SQLAlchemy。

文档：[Flask-SQLAlchemy](http://www.pythondoc.com/flask-sqlalchemy/)

## Flask-MongoEngine
Flask-MongoEngine集成了[MongoEngine](http://mongoengine.org/)。

通过它能够方便的在Flask中使用MongoDB。

文档：[Flask-MongoEngine](http://docs.mongoengine.org/projects/flask-mongoengine/en/latest/)

## Flask-Login
Flask-Login为Flask提供了用户会话管理。它能够处理如登陆、登出、持久记住用户会话等常见任务。

它将：
1. 将活动的用户ID储存在session中，让你能够方便的对他们进行登入登出操作。
2. 让你能够限制视图只允许登入（或登出）用户访问。
3. 处理常见的“记住我”功能。
4. 保护你的用户会话以防被cookie小偷窃取。
5. 之后可能会与Flask-Principal或其它验证扩展集成。

然而，它不会：
1. 将特定的数据库或其它储存方法强加给你。用户如何载入，决定权完全在你的手中。
2. 限制你使用如用户名和密码，OpenIDs，或其它验证方法。
3. 处理超出“登入登出”之外的权限。
4. 处理用户注册或账户重置。

文档：[Flask-Login](https://flask-login.readthedocs.io/en/latest/)

## Flask-Migrate
Flask-Migrate是一个使用[Alembic](https://pypi.python.org/pypi/alembic)处理Flask应用程序中SQLAlchemy数据库迁移的扩展。数据库操作由Flask命令行接口或通过[Flask-Script](grate.readthedocs.io/en/latest/)扩展而得到支持。

Flask中的SQLAlchemy只有在不存在这个表时才会按照程序中的定义新建一个表。然而，在开发过程中不免要更改表结构，此时就可以借助这个扩展来方便的更新数据库。

文档：[Flask-Migrate](https://flask-migrate.readthedocs.io/en/latest/)

## Flask-RESTful
Flask-RESTful是一个为Flask增加了快速绑定REST风格API功能的扩展。它是一个与你已经存在的ORM/库之间协同工作的轻量级抽象。Flask-RESTful鼓励使用最少设置的最佳实践。

文档:[Flask-RESTful](https://flask-restful.readthedocs.io/en/latest/)

## Flask-Admin
Flask-Admin解决了在现有数据模型上构建管理界面的无聊问题。通过一定的努力，它能让你使用一个用户友好的界面管理web服务器数据。

文档：[Flask-Admin](https://flask-admin.readthedocs.io/en/latest/)

## Flask-Bcrypt
Flask-Bcrypt是一个为Flask应用程序提供了Bcrypt散列工具的Flask扩展。

Bcrypt是一种比MD5或SHA1稍慢，但更加安全、不易碰撞的散列算法。

文档：[Flask-Bcrypt](https://flask-bcrypt.readthedocs.io/en/latest/)

## Flask-Cache
Flask-Cache用于缓存常用Web应用程序页面，从而在下一次请求时直接从缓存中返回而不用再查询、构建页面，从而极大的优化了Web应用程序的响应速度。

值得注意的是，不是每个页面都适合使用Flask-Cache缓存——数据经常变化的页面不适于被缓存。

文档：[Flask-Cache](https://pythonhosted.org/Flask-Cache/)

## Flask-SSLify
Flask-SSLify是一个简单扩展，能够将所有访问都重定向到https。

文档:[Flask-SSLify](https://pypi.python.org/pypi/Flask-SSLify)

## Flask-Bootstrap
Flask-Bootstrap为Flask应用程序提供了内建的Bootstrap支持，从而可以方便的在程序中集成Bootstrap，并且使用扩展提供的默认布局。

值得注意的是，到目前为止，Flask-Bootstrap似乎默认只支持Bootstrap2、3,不支持Bootstrap4。

文档：[Flask-Bootstrap](https://pythonhosted.org/Flask-Bootstrap/)

## Flask-Principal
Flask-Principal为Flask提供了用户权限控制。它通过提供一个松散的框架，将位于Web应用程序中的不同部分的两种服务类型提供者（身份验证提供者、用户信息提供者）联系起来。

文档：[Flask-Principal](http://pythonhosted.org/Flask-Principal/)

## Flask-DebugToolbar
Flask-DebugToolbar为应用程序添加了一个工具栏，包含许多对debugging有益的应用程序相关信息。

文档：[Flask-DebugToolbar](https://flask-debugtoolbar.readthedocs.io/en/latest/)

## Flask-Security
Flask-Security支持为Flask应用程序快速添加常用的安全机制。

文档：[Flask-Security](https://pythonhosted.org/Flask-Security/index.html)

## Flask-Paginate
Flask-Paginate提供了分页工具，可以在模板中快速简洁的创建出分页样式。

文档：[Flask-Paginate](http://flask-paginate.readthedocs.io/en/latest/)

## Flask-Mail
Flask-Mail为Flask集成了简单的SMTP邮件服务。使用它，可以方便的通过视图和脚本向用户、管理员发送邮件。

文档：[Flask-Mail](https://pythonhosted.org/Flask-Mail/)

## Flask-BasicAuth
Flask-BasicAuth使用HTTP基础访问验证功能为Flask应用提供了保护某些视图或整个应用的简洁方法。

Flask-BasicAuth常用于Flask应用程序中API的访问验证。

文档：[Flask-BasicAuth](https://flask-basicauth.readthedocs.io/en/latest/)

## Flask-Assets
Flask-Assets集成了webassets。使用它，可以方便的将不同的静态资源文件整合、压缩在一起，从而减少响应的大小，优化Web应用程序的访问速度。

文档：[Flask-Assets](https://flask-assets.readthedocs.io/en/latest/)

## Flask-PageDown
PageDown是使用JacaScript实现的客户端MarkDown到HTML的转换程序。而Flask-PageDown扩展则将PageDown集成到了Flask-WTF表单字段里。

文档：[Flask-PageDown](https://github.com/miguelgrinberg/Flask-PageDown)

## Flask-HTTPAuth
Flask-HTTPAuth是一个支持为Flask路由应用一些http验证方法的简单扩展。
Flask-HTTPAuth支持HTTPBasicAuth、HTTPDigestAuth、HTTPTokenAuth和混合验证。

文档：[Flask-HTTPAuth](http://flask-httpauth.readthedocs.io/en/latest/)

## Flask-KVSession
Flask-KVSessin重写了Flask基于客户端的session机制。不再客户端储存数据，只在客户端储存一个安全生成的ID，而实际数据则储存在服务器端。

提高了Flask Session机制的安全性。

文档：[Flask-Session](https://pythonhosted.org/Flask-KVSession/)

## 待续...
![youya](http://arian-blogs.oss-cn-beijing.aliyuncs.com/18-4-13/54750302.jpg)
╮(╯-╰)╭
