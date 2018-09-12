---
title: python3.7一些有趣的新特性
date: 2018-08-24 20:46:09
tags: python
categories: python
---
其实python3.7在两个多月前就发布了，因为各种原因（主要懒就是了qaq，一直没怎么仔细关注，所以拖到了现在。唉，转眼八月就到尾巴上了。

总之，本文将介绍python3.7中比较有趣的一些新特性。让我们开始吧。

<!--MORE-->

## dataclasses模块
python3.7中最被人关注，讨论得最广的，当然是dataclasses啦。dataclasses是python3.7新增的模块。正如这个模块的名字"数据类"一样，引入这个特性的主要目的，是为了简化一些主要功能是储存简单的数据的类的创建流程，减少代码冗余。在官方文档中，dataclasses被描述为"这个模块为将自动生成的，像\_\_init\_\_这样的特殊方法，增加到用户定义的类，提供了dataclass装饰器和相关的函数"。

### dataclass装饰器
大家以往写程序的时候可能都碰到过，需要在\_\_init\_\_方法中传递大量的参数，然后简单的将参数绑定到实例，就像这样:
```python
class Company:
    def __init__(self, name, phone, address, contact, category, staff_number=100):
        self.name = name
        self.phone = phone
        self.address = address
        self.contact = contact
        self.category = category
        self.staff_number = staff_number

    def __repr__(self):
        return f"Company(name={self.name}, phone={self.phone}, address={self.address}, contact={self.contact}, category={self.category}, staff_number={self.staff_number}"

    def __eq__(self, other):
        return (self.name == other.name && self.phone == other.phone && self.address == other.address && self.contact == other.contact && self.category == other.category && self.staff_number == other.staff_number)
```
当然，这个随意虚构出来的类可能还不够典型，然而已经可以从它身上看到许多工作实际上是在繁复、无味进行的。我们在\_\_init\_\_中声明了所需的参数，将它们一一绑定到实例，并且又在一些特殊方法中进行了许多枯燥平常的工作。

我们可以用dataclass装饰器简化这些工作。将我们想要的参数用类型注释标注出来，称为字段，然后简单的将dataclass装饰到我们想要的类，它将返回给添加了我们想要参数、和与这些参数相关的特殊方法的类。
```python
import dataclasses

@dataclasses.dataclass
class Company:
    name: str
    phone: str
    address: str
    contact: str
    category: str
    staff_number: int = 100
```
这就是所有！dataclass将为我们自动生成\_\_init\_\_、\_\_repr\_\_、\_\_eq\_\_方法，并且以我们在类中添加了类型注释的字段作为参数，在其中构造初始化、表现成字符串或者是比较是否相等的语句。

最重要的是，通过这样的方式构造出来的类和我们以传统方式构造出来的类没什么两样。我们可以对这个类再进行装饰，或者是继承，使用元类，操作都是等同的。

我们还可以通过参数定制dataclass装饰器的行为。实际上，向上面这样，我们直接给类装饰dataclass，等同于我们以默认参数调用dataclass后装饰给类。这种意义上说，dataclass实际上是装饰器工厂函数。也就是说，以下三种调用方法是等同的。
```python
@dataclass
class C:
    ...

@dataclass()
class C:
    ...

@dataclass(init=True, repr=True, eq=True, order=False, unsafe_hash=False, frozen=False)
class C:
    ...
```
大致上，dataclass的参数指定了是否自动生成与这个类相关的特殊方法。其中:

- init: init参数指定是否生成初始化方法，我们以类型注释的方式定义的字段，会成为dunder init方法的参数，然后在其中赋值给实例。如果为False，将调用父类的dunder init方法。
- repr: repr参数指定是否生成dunder repr方法。默认的dunder repr方法会以class_name(var1=value, var2=value, ...)这样的方式列举出所有定义的字段和我们赋予的值。
- eq: eq参数为True。会生成dunder eq方法。在其中比较我们定义的所有字段，所有的都相等，才返回True。
- order: order参数自动生成与排序相关的方法，如\_\_lt\_\_、\_\_le\_\_、\_\_gt\_\_和\_\_ge\_\_方法。在其中，我们定义的字段会以定义顺序，作为一个元组与另一个实例比较。需要注意的是，如果order为True，eq也必需为True，否则会弹出ValueError错误。
- unsafe\_hash: 默认下，\_\_hash\_\_方法由eq参数和fronzen参数的值生成。如果unsafe\_hash为False，且fronzen和eq参数也为True，将为类添加\_\_hash\_\_方法，hash值由定义的字段计算而得。如果eq为True，frozen为False，则类标记为不可hash。如果eq为False，类将使用父类的hash方法。然而，如果设置这个参数为True，就不管eq和fronzen参数的值，即使我们的实例实际会改变，也会强制给类添加dunder hash方法。
- fronzen: fronzen为True，则所有字段是只读的。相当于将字段设置为property。

大部分情况下，如果在类的定义中已经定义了相关的方法，则上面的相关参数将被忽略。

### field方法
大部分情况下，我们可以直接使用dataclass方法，然而有时我们还需要为具体字段指定具体行为。这种情况下，我们可以使用dataclasses.field方法。例如
```python
@dataclass
class C:
    name: str = field(init=False, default="Mike")
```
这样，name字段不会被传递给dunder init方法作为参数，它始终会有我们设置的初始值"Mike"。

field方法的定义为：
```python
def field(*, default=MISSING, default_factory=MISSING, repr=True,
          hash=None, init=True, compare=True, metadata=None)
```
大致上，其中的各个参数指定了是否将字段传入相关方法。除此之外，它的default参数指定字段的默认值，default_factory指定生成默认值的函数，metadata用于第三方扩展。

field同时具有default和default_factory参数。一般情况下，当我们为字段指定的默认只是不可变对象时，直接赋值给字段或在field的default参数中指定都可以。然而，如果我们要为字段指定一个可变对象（例如列表）作为默认值，我们需要将这个可变对象的构造函数指定为参数default_factory的值。如果我们将可变对象作为字段或default参数的值，会弹出ValueError。

这样设置的主要目的是回避python中以可变对象作为默认参数的陷阱。例如，
```python
class A:
    def __init__(self, names=[]):
        self.names = names

a1 = A()
a2 = A()
a1.names.push('Mike')
assert(a2.names[0] == 'Mike')
```
A的所有实例将分享最初在参数中指定的列表。

### \_\_post\_init\_\_方法
在某些情况下，我们的某些字段的值由其它字段生成，这种情况怎么办呢？幸运的是，dataclasses为我们提供了\_\_post\_init\_\__方法。如：
```python
@dataclass
class C:
    price: int = 1
    quantity: int = 10
    total: int = field(init=False)

    def __post_init__(self):
        self.total = self.price * self.total
```
\_\_post\_init\_\_方法将在dunder init方法之后执行。

### 特殊字段
在大部分情况下，类型注释仅仅为ide所用，dataclass不内省我们为字段添加的类型注释。然而，有两种例外的类型注释，会被dataclass检查。

其中一种是typing.ClassVar。和其名字一样，加上这个注释，表明字段是类变量。这个字段将会被dataclass忽略。

另一种是dataclasses.InitVar。加上这个注释的字段，将会传递给\_\_post\_init\_\_方法作为参数。

### 辅助方法
dataclasses模块提供了一系列与dataclass相关的辅助方法。

- fields(class_or_instance): fields方法接受被dataclass装饰的类或它的实例作为参数，以元组的形式返回其中定义的，除ClassVar和InitVar以外的字段。
- asdict(instance, *, dict_factory=dict): 接受被dataclass装饰的类的实例，以字典的方式返回字段的键值。如果字段值仍是一个被dataclass装饰的类的对象，将递归展开。
- astuple(*, tuple_factory=tuple): 同上，以元组形式返回。
- replace(instance, **changes): 接受实例，替换字段值为changes字典中所重定义的值。替换在\_\_post\_init\_\_方法之前执行。
- is_dataclass(class_or_instance): 返回参数是否是被dataclass装饰的类或它的实例。

## 延迟类型注释评估
现存的python类型注释功能有两点缺陷。

第一个缺陷是只能使用在当前作用域中已经存在的类型名。这就是说，无法将之后的变量作为当前注释。例如：
```python
class A:
    def bind_other(self, obj: B) -> A:
        pass

class B:
    pass
```
将会弹出NameError。

第二个缺陷是类型注释中的语句将会在导入时被执行，从而可能会对当前程序产生不利影响。例如：
```python
def render(source: print('must be a string')):
    pass
```
将会在被导入时显示must be a string，然后source的类型注释为None。

现在，有了延迟类型评估，这两种缺陷都可以得到解决。

例如，对于第二种而言，现在的表现为：
```python
>>>def render(source: print('must be a string')):
... pass
...
>>>render.__annotations__
{'source': "print('must be a string')"}
```

现在要使用延迟类型评估，需要从\_\_future\_\_里引入 annotations。这个功能将会在python 4.0成为正式功能。

## 纳秒级时钟精度
python的time.time函数返回一个以秒为单位的浮点数，而浮点数在计算机中天生就是不准确的。因此，python3.7引入了一系列以纳秒的单位，返回一个整型值的时间相关的函数。如：

- time_ns: 返回1970年1月1日以来的纳秒数。

许多新函数仅仅是在原始函数后加了'\_ns'作为标识。

## 自定义模块属性访问
python3.7支持模块级别的\_\_getattr\_\_和\_\_dir\_\_方法。只需要将这些方法定义在模块的\_\_init\_\_.py文件中，就可在导入后的模块触发这些方法。

## 使用breakpoint()设置断点
以往设置断点，需要引入pdb后调用pdb.set_trace()。现在仅需要在pdb.set_trace()的地方调用breakpoint函数，就可设置断点。

## 其它改变
- 强制utf8模式： 在启动python的命令行加上`-X utf8`可以使CPython无视本地环境，强制使用utf8模式。
- 显示导入模块的时间： 在启动python的命令行加上`-X importtime`，可以在每次导入模块时显示耗费的时间。
- async和await成为关键字

## 参考
https://www.python.org/dev/peps/pep-0557

https://docs.python.org/3/whatsnew/3.7.html
