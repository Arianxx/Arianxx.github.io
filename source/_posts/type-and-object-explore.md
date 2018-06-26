---
title: python中type和object
date: 2018-05-31 17:50:25
tags: 
    - Python
categories: Python
---
>一生一代一双人

## type和object
python中内置了两个类，type和object，用isinstance和issubclass测试这两个类会发现一些奇怪的特性，如下：
```python
# object是自身的实例
>>> isinstance(object, object)
True
# object也是type的实例
>>> isinstance(object, type)
True
# type是自身的实例
>>> isinstance(type, type)
True
# type是object的实例
>>> isinstance(type, object)
True
# object是自身的子类
>>> issubclass(object, object)
True
# object不是type的子类
>>> issubclass(object, type)
False
# type是自身的子类
>>> issubclass(type, type)
True
# type也是object的子类
>>> issubclass(type, object)
True
```
<!--MORE-->
可以看到，在这里面，type和object互为实例和子类，只有一个例外。而平时，在我们编写程序的过程中，也时常会注意到我们自己的类会有一些属性指向type和object，如：
```python
>>> class Foo:
...     pass
...
>>> Foo.__class__
<class 'type'>
>>> Foo.__base__
<class 'object'>
```
那么，type和object这两个类有怎样的区别和联系呢？本文将探讨一些这方面的内容。

## 继承和实例化
类的继承和实例化是编程语言的面向对象特性里面重要的两个方面，对于拥有一切皆是对象语言的python，自然也对其有良好的实现。并且得益于python动态语言的性质，我们可以在程序运行时方便的内省对象的各项属性，如上的：
```python
>>> class Foo:
...     pass
...
>>> class Bar:
...     pass
...
>>> f = Foo()
>>> f.__class__
<class '__main__.Foo'>
>>> b = Bar()
>>> b.__class__
<class '__main__.Bar'>
```
可以看到，对象的`__class__`属性实际上表明了这个对象有哪个类实例化而来。前面说到，在python中，一切皆是对象，类也是一种对象，那么，作为对象的类也拥有`__class__ `属性。而作为对象的类，其`__class__`属性指向的 type，就表明，这些类是由 type这个元类构建而来。

而`__base__`属性的特性如下：
```python
>>> class Foo():
...     pass
...
>>> class Bar(Foo):
...     pass
...
>>> Bar.__base__
<class '__main__.Foo'>
```
可以看到`__base__`属性实际上指向一个类的父类。如果一个类继承了另一个类，那么这个类的 `__base__`属性就指向它继承的那个类。（如果是多重继承，这些类就在`__bases__`属性里面）

## 作为继承关系顶点的object
一个类可以继承自其它类，被继承的那个类称为父类。在python中，如果没有显示指定一个类继承自哪个父类，那么这个类就继承自object类。这意味着，在python中，**object实际是所有类的父类，是继承树的根节点，其内蕴含了一些类基本的共有方法。**

python还规定，object类没有父类。如：
```python
>>> class Foo:
...     pass
...
>>> Foo.__base__
<class 'object'>
>>> issubclass(Foo, object)
True
>>> f = Foo()
>>> isinstance(f, object)
True
# object没有父类
>>> object.__base__
>>> 
```

## 作为对象的顶点的type
前面说过，在python中，一切皆是对象，类也是对象。是对象就应该有其对应的构造类型。一般的对象由它们的类实例而来。那么作为类本身，它们应该由哪个类实例而来呢？在python中，这个类就是type，**一切的类都是type类型的实例，type的构造类是其自身，type是自身的实例。**

因此，type代表了一切实例关系的顶点。可以通过如下的属性观察到：
```python
>>> class Foo:
...     pass
...
>>> Foo.__class__
<class 'type'>
```

<!--MORE-->
## type与object
于是，由前面的叙述，可以总结出，object是python里面向对象继承关系的体现，一切的类都是object的子类；type是python里“一切皆是对象”的动态特性的体现，一切的类都是type类型的实例，由type类型构造而来。并且，object类没有父类，type是其自身的实例。

现在，就可以解释开头的奇特特性了：

```python
>>> isinstance(type, type)
True
```
这里体现出type是其自身的实例。

```python
>>> issubclass(type, object)
True
```
这里体现出object是python中一切类的父类，包括type，type也是object的子类。

```python
>>> isinstance(object, type)
True
```
体现出一切类都是type的实例，包括object。

```python
>>> isinstance(type, object)
True
```
type也是object的实例。因为type是自身的实例，而type自身又是object的子类。如果一个对象是某个类的实例，那么这个对象也是那个类`__mro__`链上（父类）所有类的实例。因此type也是object的实例。

```python
>>> issubclass(object, object)
True
```
虽然object没有父类，但python规定用issubclass判断继承关系时，对自身返回True，因此这里返回True。可以看作，python中一切类也是自身的子类（父类）。

```python
>>> issubclass(object, type)
False
```
object是type的实例，但不是type的子类。object是一切类的父类。

```python
>>> isinstance(object, object)
True
```
object是type的实例，type是object的子类，因此object是自身的实例。

```python
>>> issubclass(type, type)
True
```
一切类都是自身的子类。

## 元编程
上面提到，一切类都是type的实例，这体现出python动态语言的特性。实际上，通过type，可以实现`元编程`，在运行时动态创建、修改类。这个话题就在另一篇文章里再说吧！

## 参考
https://www.jianshu.com/p/7454c02e86c4

http://www.cnblogs.com/busui/p/7283137.html

https://www.zhihu.com/question/38791962