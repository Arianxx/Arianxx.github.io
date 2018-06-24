---
title: python在异常捕获里抛出异常
date: 2018-06-07 22:50:17
tags:
    - Python
categories: Python
---
## python2异常对象
有时，我们需要在捕获一个异常之后，在捕获的语句里面抛出另外一个异常。例如：
```python
>>> try:
...     print(1/0)
... except ZeroDivisionError as e:
...     raise ValueError(e)
...
Traceback (most recent call last):
  File "<stdin>", line 2, in <module>
ZeroDivisionError: division by zero

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "<stdin>", line 4, in <module>
ValueError: division by zero
```

上面在捕获除零异常后，重新在处理语句里抛出了ValueError，并将除零异常的信息传给了ValueError。同时，可以发现抛出的信息还附带了追踪信息，可以看到异常的抛出顺序。

然而，在python2里，从一个异常捕获中直接抛出另一个异常，并不会附带追踪信息：
```python
>>> try:
...     print(1/0)
... except ZeroDivisionError as e:
...     raise ValueError
...
Traceback (most recent call last):
  File "<stdin>", line 4, in <module>
ValueError
```

python2异常抛出语句的语法是：raise exc, value, traceback。第一个参数是Exception的子类或子类的实例，第二个参数是初始化异常的信息，第三个参数是traceback对象。

python2中，可以通过这种方式看到traceback：
```python
>>>import sys
>>> def bar():
...     try:
...             foo()
...     except RuntimeError as e:
...             raise
...
>>> def bar():
...     try:
...             foo()
...     except ValueError as e:
...             raise RuntimeError(e), None, sys.exc_info()[2]
...
>>> bar()
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "<stdin>", line 3, in bar
  File "<stdin>", line 3, in foo
RuntimeError: integer division or modulo by zero
```

python3简化了异常抛出语句的语法，不再支持python2抛出三元素元组的方式，而是简化为了一个exception参数。例如，在python2中原来有多个语句实现同一个异常抛出效果：

```python2
>>> raise RuntimeError, ValueError
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
RuntimeError: <type 'exceptions.ValueError'>
>>> raise RuntimeError(ValueError)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
RuntimeError: <type 'exceptions.ValueError'>
```

这显然违背了python之禅里"There should be one-- and preferably only one --obvious way to do it"的理念。

## python3异常对象

所以，在python3中，不再支持元组的形式的异常抛出，只支持抛出Exception的子类或实例。如果是子类，就无参数调用得到实例再抛出；如果是实例则直接抛出。并且，python3为异常对象新增加了几种特殊方法。例如，增加了`__context__`方法，用于在多重异常抛出中保留以前异常的抛出信息：
```python
>>> try:
...     1/0
... except ZeroDivisionError as e:
...     print(e.__context__)
...
None
>>> try:
...     1/0
... except ZeroDivisionError as e:
...     a = []
...     try:
...             a[1]
...     except IndexError as e:
...             print(e.__context__)
...
division by zero
```

python3的异常对象还增加了`__traceback__`信息，用于在多重异常抛出中记录以前的抛出信息，从而简化了多重异常抛出的操作。在python3中，可以通过使用raise...from...语法快速指定traceback对象：
```python
>>> try:
...     print(1/0)
... except ZeroDivisionError as e:
...     raise ValueError from e
...
Traceback (most recent call last):
  File "<stdin>", line 2, in <module>
ZeroDivisionError: division by zero

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "<stdin>", line 4, in <module>
ValueError
```

可以看到不单附带了跟踪信息，还有“The above exception was the direct cause of the following exception”这句指明了异常之间的关系。

并且，在python3中，即使不使用raise ... from ...语法，默认也附带了追踪信息，保存在`__context__`中，以"during handling another exception happened"的形式展现：
```python
>>> try:
...     print(1/0)
... except ZeroDivisionError:
...     raise ValueError
...
Traceback (most recent call last):
  File "<stdin>", line 2, in <module>
ZeroDivisionError: division by zero

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "<stdin>", line 4, in <module>
ValueError
```

还可以通过异常对象的with_traceback方法指定traceback对象，这种方法的提示语句如上：
```python
>>> try:
...     print(1/0)
... except ZeroDivisionError as e:
...     raise ValueError.with_traceback(e)
...
Traceback (most recent call last):
  File "<stdin>", line 2, in <module>
ZeroDivisionError: division by zero

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "<stdin>", line 4, in <module>
ValueError: division by zero
```


## `__cause__`属性
实际上，在使用 raise ... from ... 语法时，一个名为 `__cause__`的属性就被赋给异常对象，这个属性直接指明了异常发生的原因。当`__cause__`被设置的时候，`__suppress_context__`方法也会被同时设置为True。如果`__suppress_context__`被设置为True，在打印traceback信息时，`__context__`就会被忽略。

所以，如果在某些时候，想要忽略多重异常抛出中的上层的异常信息，可以使用 raise ... from None来实现：
```python
>>> try:
...     print(1/0)
... except ZeroDivisionError:
...     raise ValueError from None
...
Traceback (most recent call last):
  File "<stdin>", line 4, in <module>
ValueError
```

可以发现上层的ZeroDivisionError被忽略了。

## 结语
有一种常见的python编程风格，叫做`EAFP(easier to ask for forgiveness than permissino，取得原谅比获得许可容易)`。先假定方法存在直接调用，如果不存在就捕获异常。这种方法简明轻快，体现出了python的鸭子类型和松散协议。

这种方法的特点就是代码块中有较多的try和except关键字。灵活运用异常，能够更得心应手的使用这种风格编程。

## 参考
https://stackoverflow.com/questions/24752395/python-raise-from-usage

https://mozillazg.com/2016/08/python-the-right-way-to-catch-exception-then-reraise-another-exception.html#hidid1