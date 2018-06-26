---
title: 浅析python中super用法，兼及继承机制
date: 2018-05-14 22:05:27
tags:
    - Python
    - 算法
categories: Python
---
>远在天边，我们一无所见，即使近在眼前，也仅仅是连续不断而变幻不定的表象。 

## 开始之前
在学习python的过程中，一直对super的用法感到稍许疑惑。虽然直到它的基本使用方法，却一直觉得模模糊糊。本文将根据实例简要探讨python3中super函数的行为，以加强对super函数的认知，兼及一些相关方面的内容。

本文将简要谈谈我对对象和继承机制的理解，最终探讨super的用法。
<!--MORE-->

## Ⅰ.面向对象机制
`面向对象(OOP, Object Oriented Programming）`是目前编程语言中一种主流的思想，python从设计初期就已经是一门面向对象的语言。python为面向对象编程提供了强大的语法支持。因此，在python中，使用面向对象的方式进行程序设计是十分自然并且容易的。

理所当然，一旦提到面向对象的编程思想，那么便会自然而然想到面向对象思想中的一些重要概念。比如说：`类（Class)`。类是一种数据结构，简单来说，可以理解为对某些拥有共同属性，或行为的对象的抽象。它可以视作这些拥有相同属性或行为的对象的蓝图，封装了这些对象的共同属性或行为，使得程序设计更模块化，提高了代码的可复用性——一个`对象（Object）`是它的类的实例，它能够访问它的构造类中的所有属性或方法。

可以将python中的类与对象类比到现实中。这样，对象就是现实世界中的客体，是一种具体的实体。现实世界中的所有事物都可以看作一个对象。例如，一个人。当我们谈到这个对象时，我们所想到的，是这个带有数量词的、具体的、实在的个体，是“这个人”而不是“那个人”。而现实世界里面存在许许多多的人。这些所有的人有某些共同的特征，我们将这些特征聚合起来，所形成的一个抽象的、宽泛的“人”的这个形式，就是所有作为人的对象的类。

每个具体的对象都有其独特的`标识`。例如，在现实中，每个人都会有一个名字。一般来说，在某个给定范围的命名空间中，这个标识是唯一的。我们可以说，某个具有独特标识符的对象属于什么类。例如，张三是人，就是说"张三"属于"人"这个类。这样，可以发现，一般情况下，凡是可以说成“某个东西是什么”这种句法的，都可以抽象出类与对象的关系。

类比到现实中，类与对象是一种所属关系，对象是一种客观存在的实体。而放到具体的程序设计中来说，类可以视作对某些具有共同特征或行为的数据的`抽象`。

## Ⅱ.类的继承机制
一个对象可以说成是某个类的实例，一般情况，就可以说成”对象是类”这种形式。然而，在许多情况下，在这样抽象之后，我们仍然可以发现，类也有其自身的所属。例如说，泰迪是一只熊，在这里，"泰迪"是具体的对象，"熊"是"泰迪"的类，而“熊”这个类，又由“哺乳动物”这个类细分而来。我们可以这样说，熊继承自哺乳动物，而泰迪既是一只熊，也是一只哺乳动物。这样，父类就可以理解为对类的基本属性的抽象，子类是对于父类的补充。

![补充](http://arian-blogs.oss-cn-beijing.aliyuncs.com/18-5-15/85242660.jpg)

简单来说，对象之于类，是“某个东西是什么”，而子类之于父类，是子类补充了父类。

在python中，如果一个子类继承了父类，就称这个父类为子类的`base class`，并且，这个子类的所有base class，都可以在`__bases__`属性中访问。这个子类的实例，也可以同时访问子类所有父类、以及后续的父类内的属性或方法（此处不考虑带前置双下划线的私有方法）。

如：
```python
>>> class Animal():
...     def kind(self):
...         print("I'm an animal.")
...
>>>
>>> class Bird(Animal):
...     def skill(self):
...         print("I can fly.")
...
>>>
>>> bird = Bird()
>>> bird.skill()
I can fly.
>>> bird.kind()
I'm an animal.
```

可见，实例可访问它的构造类以及之后的父类中的方法。

同时，子类可以`覆盖`父类的方法。这样，访问实例中的这个方法时，就访问它的构造方法内重写的那个方法，而不向后追溯。

如：
```python
>>> class Animal():
...     def kind(self):
...         print("I'm an animal.")
...
>>>
>>> class Bird(Animal):
...     def kind(self):
...         print("I'm a bird.")
...
>>>
>>> bird = Bird()
>>> bird.kind()
I'm a bird.
```

<!--MORE-->

python还支持`多重继承`。一个子类，可以同时拥有多个父类，同时继承这些父类的属性或方法。可以通过访问子类的`__bases__`属性获得它的父类：
```python
>>> class Food():
...     eatable = True
...
>>> class Ice():
...     cold = True
...
>>>
>>> class IceCream(Food, Ice):
...     pass
...
>>> IceCream.__bases__
(<class '__main__.Food'>, <class '__main__.Ice'>)
```

实例可以访问这些父类的方法：
```python
>>> IceCream.eatable
True
>>> IceCream.cold
True
```

但是，思考一下，如果子类继承了多个父类，同时这些父类拥有某些相同的属性或方法，实例该访问哪个方法呢？

这个问题的解决方案，就是依赖于特定的Method Resolution Order (MRO)。

## Ⅲ.MRO
python利用MRO来决定多重继承中属性或方法的搜索顺序。如果一个类不止具有一个基类，那么，可以访问这个类的`__mro__`属性以获取其MRO链。在python3中，[C3算法](https://en.wikipedia.org/wiki/C3_linearization)是唯一支持的MRO算法。

一般将C3算法理解为类似于广度优先搜索，但实际上它又与广度优先搜索有一定差别。

考虑下面的继承关系：

![继承](http://arian-blogs.oss-cn-beijing.aliyuncs.com/18-5-15/7957065.jpg)

```python
>>> class A():
...     id = 1
...
>>>
>>> class B(A):
...     id = 2
...
>>>
>>> class C(A):
...     id = 3
...
>>>
>>> class D(B):
...     pass
...
>>>
>>> class E(C):
...     pass
...
>>>
>>> class F(D, E):
...     pass
...
>>>
```

在这里，类F同时继承了类D和类E，而类D、E又分别继承了B、C，最终继承自类A。如果实例化一个类F，查看其id属性，最终结果会是哪一个？

实际为：
```python
>>> f=F()
>>> f.id
2
```

可以观察到，实际上访问了类B中的属性。

可以如前所述的访问类F的`__mro__`属性查看其MRO链：
```python
>>> F.__mro__
(<class '__main__.F'>, <class '__main__.D'>, <class '__main__.B'>, <class '__main__.E'>, <class '__main__.C'>, <class '__main__.A'>, <class 'object'>)
```

访问顺序为：F > D > B > E > C > A。可以看到C3算法与广度优先算法的区别。按照广度优先算法，应该是F > D > E > B > C > A。然而这里先深度优先搜索到了与其它支链有交点的节点，然后返回去进行广度优先搜索。

实际上，在python3中的MRO算法为：对于一个有多重父类的子类，它的MRO链为其自身与其父类的merge()线性操作的结果。用表达式表示为：`L[C(B1...BN)] = C + merge(L(B1)+..L(BN)+B1+...BN)`

其中，merge的规则为：

1. 递归展开其内的L为MRO列表。
2. 取第一个列表中的第一个元素，如果这个元素不出现之后列表，或者不是其它列表除首元素之外的元素，就将它提取到merge外面，作为最终MRO链的一员，同时消去merge中的这个元素。
3. 重复第二步直到遇到不可提取的元素，对下一个列表重复第二步。直到不存在元素，MRO链构建完成。
4. 否则，这个继承不合法。

例如，对于例子而言，其求MRO链的过程就是：
```
L(F(D, E)) = F + merge(L(D) + L(E) + D + E)
           = F + merge([D, B, A] + [E, C, A] + D +E)
           = F + D + merge([B, A] + [E, C, A] +E)
           = F + D + B + merge(A + [E, C, A] + E)
           = F + D + B + E + merge(A + [C, A])
           = F + D + B + E + C + merge(A)
           = F + D + B + E + C + A
```

与由`__mro__`属性看到的MRO链一致。

那么，到现在为止，我们已经知道如何继承，如何多重继承，以及在多重继承中访问特性，python搜索的机制。同时，我们已经可以覆盖父类中的属性或方法。那么，还剩下最后一点，python继承方面的机制就完善了。那就是，如果我们继承父类后，又覆盖了父类中的特性，我们该如何才能访问到父类中的那个特性呢？

如果覆盖了方法，最直观的调用父类中方法的方式，是直接在那个方法中通过父类来调用方法，然后传入自身的实例。就像这样：
```python
>>> class Food():
...     def say(self):
...         print("I'm a food.")
...
>>>
>>> class IceCream(Food):
...     def say(self):
...         Food.say(self)
...         print("And I'm a ice cream.")
...
>>>
>>> ice_cream = IceCream()
>>> ice_cream.say()
I'm a food.
And I'm a ice cream.
```

然而通过这种方式所产生的一个问题是，在如下这种情况下，通过这种方式所产生的调用会出现重复调用：
```python
>>> class Food():
...     def say(self):
...         print("I'm Food.")
...
>>>
>>> class Water(Food):
...     def say(self):
...         Food.say(self)
...         print("I'm Water.")
...
>>>
>>> class Ice(Food):
...     def say(self):
...         Food.say(self)
...         print("I'm Ice.")
...
>>>
>>> class IceCream(Water, Ice):
...     def say(self):
...         Water.say(self)
...         Ice.say(self)
...
>>>
>>> ice_cream = IceCream()
>>> ice_cream.say()
I'm Food.
I'm Water.
I'm a food.
I'm Ice.
```

这样，Food中的say方法被无意间调用了两次。

解决这个办法，使得在继承关系中，能够正确调用父类方法的工具，就是使用python中的super对象。

## Ⅳ.super对象
在python中，super对象用于构造访问给定子类的MRO链上，父类特性的代理。它接受两个参数，第一参数是要构造代理的对象，第二个参数是要绑定给父类参数的对象。它可以这样用：
```python
>>> class Food():
...     def say(self):
...         print("I'm Food.")
...
>>>
>>> class Water(Food):
...     def say(self):
...         super().say()
...         print("I'm Water.")
...
>>>
>>> class Ice(Food):
...     def say(self):
...         super().say()
...         print("I'm Ice.")
...
>>>
>>> class IceCream(Water, Ice):
...     def say(self):
...         super().say()
...
>>>
>>> ice_cream = IceCream()
>>> ice_cream.say()
I'm Food.
I'm Ice.
I'm Water.
```

可见，它给出了理想的结果，最高的父类Food仅被访问了一次，同时两个中间的父类都访问了一次。

**事实上，super搜寻特性的机制与使用getattr访问这个子类的机制相同（即，使用点运算符访问特性），都是根据`__mro__`属性中给出的链进行搜寻。经过super代理的访问，会转发给MRO链上的下一个类**。如果最终super没有在链上的对象里找到想要访问的方法，最后又没有在super对象上自身找到，就会弹出AttributeError错误。

super不是一个函数，而是一个对象，返回一个代理对象。通过这个代理对象访问的所有方法或属性，都会沿给定类的MRO链查找。需要注意的是，**如果父类中存在与super对象自身相同的特性，那个特性就会覆盖super本身的特性。**如：
```python
>>> class Food():
...     pass
...
>>>
>>> food = Food()
>>> print(super(Food, food).__str__())
<__main__.Food object at 0x0000020FE57D6C50>
>>> print(getattr(super, '__str__')(super))
<class 'super'>
```

可见，通过点运算符访问的，被转发给了代理类的父类。通过getattr函数则可以得到正确的结果。

super的第一个参数是指定要在其上MRO链搜寻特性的类，第二个参数会被绑定给将要调用的方法。第二个参数允许两种类型：

1. 如果第二个参数是对象，那么这个对象必须是第一个参数的实例。也就是isinstance(arg1, arg2)返回True。
2. 如果第二个参数是类（类型对象），那么这个类必需是第一个参数的子类。也就是issubclass(arg1, arg2)返回True。

对于第一种情况，如果将要调用的是普通方法，这个对象会被绑定为其第一个参数；第二种情况，如果将要调用的是类方法，这个类将会被绑定为第二个参数。除此之外，不作绑定。如：
```python
>>> class Food():
...     def normal(self):
...         print('normal')
...     @classmethod
...     def cls(cls):
...         print('cls')
...     @staticmethod
...     def static():
...         print('static')
...
>>>
>>> class Ice(Food):
...     pass
...
>>>
>>> ice = Ice()
>>> super(Ice, ice).normal()  # 第二个参数是实例
normal
>>> super(Ice, Ice).cls()  # 第二个参数是类
cls
>>> super(Ice, ice).static()
static
>>> super(Ice, Ice).static()
static
```

在一般情况下，我们看到的调用super的方式直接是super()，而没有传递任何参数，这是针么回事？实际上，调用super()就等同于调用了super(type(self), self)，这种省略形式只能在类的方法中调用。

最后，有趣的一点是，在途中我打算查看super对象的源码时，通过pycharm，却只看到了带有“real signature unknown”注释的pass实现。这说明python是在c语言层面实现super对象的。

## 参考链接
https://www.jianshu.com/p/45619cf50aa7

https://docs.python.org/3/library/functions.html#super

https://en.wikipedia.org/wiki/C3_linearization