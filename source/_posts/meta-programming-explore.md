---
title: 内省python元类执行流程
date: 2018-05-31 20:44:06
tags: 
    - Python
categories: Python
---
## 引言
上一篇文章里面曾简短提到了在python中使用type类可以实现元编程。实际上，在python，存在几种类型的元编程，包括使用装饰器动态修改类或函数的功能、使用魔术方法重写python内置操作符的行为等，还有使用元类在运行时动态的创建和修改类。本文主要探讨python中使用元类进行元编程时，其中类方法的调用顺序和流程的问题。我想理解了这一点就会对使用元类有更深一点的认知。

## 什么是元类
然而，究竟什么是`元类`？要理解这一点，就需要理解python独特的动态语言特性。在python中，一切都被视为对象。对象的一大特性就是可以在程序运行时，根据不同的上下文而创建。那么，依照这种思想，类也应该是一种对象。把类视为一种对象，在程序运行时，像对象那样动态创建或修改，这种行为就是元编程的一种。能够在程序运行时动态`创建或修改类的类`就被称为`元类`。

所有的对象都由某个类构造而来，那么对于元类，因该由哪种类构造而来呢？在python中，这个类就是type。所有的类都是type的实例，这实际上蕴含了一个思想，所有类都可以`看作`(只是看作)由type类创建而来的。type是一个类，这个类在运行时构造了另外的类。type类是python内置的一个元类。所以，藉继承type类，我们就可以创建出自己的元类。

一个简单的示例：
```python
>>> class MetaClass(type):
...     pass
...
# 在声明中使用metaclass指定元类，就会用指定的元类来构建类
>>> class SubClass(metaclass=MetaClass):
...     pass
...
>>> SubClass.__class__
<class '__main__.MetaClass'>
>>> MetaClass.__base__
<class 'type'>
```
这个简单的元类示例什么都没有做，但它体现出了python元编程的一些特性。SubClass的`__class__`属性变为了MetaClass，表明这个类是由MetaClass类，而不是通常的type类所构造的。同时，可以看到我们自定义的元类是type的子类。

## 一些与元类编程相关的特殊方法
在了解真正使用元类编程的方法之前，需要预备一些知识——一些与构造类有关的特殊方法。

### `__new__`方法
`__new__`方法是一个静态方法。当调用类构造一个实例时，这个实例就是由`__new__`方法产生。`__new__`方法的第一个参数是调用的类本身。

### `__init__`方法：
`__init__`方法修饰将要构造的实例。在返回实例之前做一些初始化工作。

### `__call__`方法：
当调用一个实例时，会尝试调用它的构造类（及父类）的`__call__`方法。

## 另一个例子
```python
info = 'Success'


class SetUp(type):

    def __new__(cls, *args, **kwargs):
        # 调用超类中的__new__方法得到将要产生的子类对象。
        sub_cls = super().__new__(cls, *args, **kwargs)
        return sub_cls

    def __init__(self, *args, **kwargs):
        # 根据外部信息修饰子类
        self._info = info
        return self

    def __call__(cls, *args, **kwargs):
        # 调用子类产生实例，实际上是调用了元类中的__call__方法。这里使用这一点实现单例模式。
        if not getattr(cls, '_instance', None):
            cls._instance = cls.__new__(cls)
            cls.__init__(cls._instance, *args, **kwargs)

        return cls._instance


class ExcuteClass(metaclass=SetUp):

    def __init__(self):
        # 只会被打印一次。
        print('Info is: ', self._info)


excute1 = ExcuteClass()
excute2 = ExcuteClass()
print(excute1 == excute2)
```

执行结果为：
```python
Info is:  Success
True
```

这个例子展示了元类的一些动态特性。在这里第一个`info = 'Success'`可以看作随上下文不同而变化的信息，元类SetUp根据这个信息的不同将会创建蕴含不同信息的子类。同时，元类本身通过`__call__`方法干涉了子类实例的创建，实际上实现了`单例模式`。在这里，子类只会被初始化一次，只会产生一个实例。

## 内省执行流程
那么，使用元类时，详细的顺序究竟是怎么样的呢？先后调用了哪些方法？刚接触元类时，或许许多人都会有这些疑惑。幸亏得益于python强大的动态性，我们可以在运行时方便的内省程序的状况。

可以藉由下面的程序观察到元类的执行流程：
<!--MORE-->
```python
def self_explain(ob):
    # 内省传入的对象
    pre_space = ' ' * 3
    try:
        # 内省类名。只有类才有 __name__ 属性。
        print(pre_space, 'Class named `{ob.__name__}`.'.format(ob=ob))
    except AttributeError:
        print(pre_space, 'Have not class name.')

    try:
        # 内省基对象。只有类才有 __obses__ 属性。
        print(pre_space, 'Inherits from `{}`.'.format(
            [base.__name__ for base in ob.__bases__]
        ))
    except AttributeError:
        print(pre_space, 'Have not bases class.')

    try:
        # 类和实例都有 __class__ 属性。
        print(pre_space, 'Instance of `{ob.__class__}`.'.format(ob=ob))
    except AttributeError:
        print(pre_space, 'Have not parent class.')

    # 最后内省对象的 id。相同的对象具有相同的id。
    print(pre_space, "My id is {}.".format(id(ob)))


def explain(func):
    def internal_func(*args, **kwargs):
        # 因为这里用第一个参数的 __class__ 属性来判断其执行在哪个类里。这种方式
        # 默认第一个参数是这个类的实例，然而在 __new__ 方法里，第一个
        # 参数是类本身，其 __class__ 属性是 type，无法反映流程情况。所以如果判断在 __new__ 方法里，
        # 就直接调用 __new__ 将第一个参数（类本身）实例化，访问其 __class__ 属性得到类名。
        # 使用这种方法而不访问 __new__ 里第一个参数的 __name__ 方法的原因是，这样做，
        # 之后就能像对待普通方法一样对待 __new__，内省程序的执行情况。
        in_new = func.__name__ == '__new__'
        if not in_new:
            self = args[0]
        else:
            # 如果在 __new__ 里，调用 __new__ 得到实例。
            self = func(*args, **kwargs)

        print('In {func.__name__} of {self.__class__}.'
              .format(func=func, self=self))
        print('Inspect first argument:')
        self_explain(args[0])

        if in_new:
            # 如果在 __new__ 方法里，因为之前已经构造过了，直接返回。
            return_value = self
        else:
            return_value = func(*args, **kwargs)

        print('Inspect return value:')
        self_explain(return_value)
        print('_' * 32)

        return return_value

    return internal_func


class RootClass(type):
    # __new__ 方法是静态方法。
    @staticmethod
    @explain
    def __new__(cls, *args, **kwargs):
        return super().__new__(cls, *args, **kwargs)

    @explain
    def __init__(self, *args, **kwargs):
        super(RootClass, self).__init__(*args, **kwargs)

    @explain
    def __call__(self, *args, **kwargs):
        return super(RootClass, self).__call__(*args, **kwargs)


class SubClass(metaclass=RootClass):
    @staticmethod
    @explain
    def __new__(cls, *args, **kwargs):
        return super().__new__(cls, *args, **kwargs)

    @explain
    def __init__(self, *args, **kwargs):
        super(SubClass, self).__init__(*args, **kwargs)

    @explain
    def __call__(self, *args, **kwargs):
        print('You call the SubClass instance.')


if __name__ == '__main__':
    fmt_str = '\n{:_^64}\n'

    print(fmt_str.format('Start excution'))

    print(fmt_str.format('Instantiate the SubClass.'))
    instance = SubClass()

    print(fmt_str.format('Invoke the instance.'))
    instance()
```

这段简单的程序主要用一个装饰器来内省了元类与子类中的调用信息与参数、返回值状况。

其执行结果如下：
```python
In __new__ of <class '__main__.RootClass'>.
Inspect first argument:
    Class named `RootClass`.
    Inherits from `['type']`.
    Instance of `<class 'type'>`.
    My id is 2281002834456.
Inspect return value:
    Class named `SubClass`.
    Inherits from `['object']`.
    Instance of `<class '__main__.RootClass'>`.
    My id is 2281002701784.
________________________________
In __init__ of <class '__main__.RootClass'>.
Inspect first argument:
    Class named `SubClass`.
    Inherits from `['object']`.
    Instance of `<class '__main__.RootClass'>`.
    My id is 2281002701784.
Inspect return value:
    Have not class name.
    Have not bases class.
    Instance of `<class 'NoneType'>`.
    My id is 1939641552.
________________________________

_________________________Start excution_________________________


___________________Instantiate the SubClass.____________________

In __call__ of <class '__main__.RootClass'>.
Inspect first argument:
    Class named `SubClass`.
    Inherits from `['object']`.
    Instance of `<class '__main__.RootClass'>`.
    My id is 2281002701784.
In __new__ of <class '__main__.SubClass'>.
Inspect first argument:
    Class named `SubClass`.
    Inherits from `['object']`.
    Instance of `<class '__main__.RootClass'>`.
    My id is 2281002701784.
Inspect return value:
    Have not class name.
    Have not bases class.
    Instance of `<class '__main__.SubClass'>`.
    My id is 2281036607104.
________________________________
In __init__ of <class '__main__.SubClass'>.
Inspect first argument:
    Have not class name.
    Have not bases class.
    Instance of `<class '__main__.SubClass'>`.
    My id is 2281036607104.
Inspect return value:
    Have not class name.
    Have not bases class.
    Instance of `<class 'NoneType'>`.
    My id is 1939641552.
________________________________
Inspect return value:
    Have not class name.
    Have not bases class.
    Instance of `<class '__main__.SubClass'>`.
    My id is 2281036607104.
________________________________

______________________Invoke the instance.______________________

In __call__ of <class '__main__.SubClass'>.
Inspect first argument:
    Have not class name.
    Have not bases class.
    Instance of `<class '__main__.SubClass'>`.
    My id is 2281036607104.
You call the SubClass instance.
Inspect return value:
    Have not class name.
    Have not bases class.
    Instance of `<class 'NoneType'>`.
    My id is 1939641552.
________________________________
```

可以看出，在程序开始时，执行我们if后的语句前，先自动执行了创建子类的操作。

创建子类首先调用了元类 RootClass 的 `__new__`方法，其第一个参数是元类本身，然后返回了一个类，其 `__name__`属性为子类 SubClass，是 RootClass的实例。显然这个类就是我们需要的子类。创建子类后，调用了元类 RootClass的 `__init__`方法，其第一个参数是我们刚才创建出的子类，然后返回None（不返回值）。

接着，开始执行if后的语句，首先我们实例化了子类。

实例化子类时，首先调用了元类里的`__call__` 方法，其第一个参数是子类本身。然后，接着调用了子类的 `__new__` 和 `__init__` 方法，显然是在 `__call__` 方法里，使用传入的子类调用的。然后，返回了子类的实例。

最后，调用实例时，调用了子类里的 `__call__`方法，其第一个参数是实例，不返回值。

## 总结
最后，我们可以得出元类时，各方法的实行顺序如下：

+ 构建子类：
    - 元类:
        + `__new__`(元类， ...)
        + `__init__`(子类，...)
+ 实例子类：
    - 元类：
        + `__call__`(子类，...)
        + 子类：
            - `__new__`(子类，...)
            - `__init__`(实例，...)
+ 调用实例：
    - 子类：
        + `__call__`(实例)

最后，实际上，上面的装饰器根据并不知道将要接受什么样的对象，只是在调用了相应的接口，根据参数的不同自动执行了不同的动作。这在无意间利用了python推崇的`鸭子类型`这一点风格，也就是其它语言的`多态`。不需要有严格的继承机制，只要关注其实现的接口；不关注其类型本身，而关注其具体的使用方法。
