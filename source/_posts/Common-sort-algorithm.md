---
title: 十种常见的排序方法
date: 2018-06-22 19:48:09
tags:
    - python
    - 算法
categories: python
---
## 简介
本文介绍了十种常见简单排序算法的python实现。

将要介绍的这十种排序算法分别是——冒泡排序、选择排序、插入排序、希尔排序、快速排序、归并排序、堆排序、计数排序、基数排序、桶排序
<!--MORE-->

## 冒泡排序
一遍遍遍历元素，两两交换其中不符合顺序的元素，将最大（或最小的）那个元素提取到最边缘的位置，直到不再有需要交换的元素为止。冒泡排序时常是排序算法中比较简单，也比较低效的一种排序方式。其时间复杂度为`O(n^2)`，空间复杂度为`O(1)`。

实现：
```python
# 冒泡排序
def bubble_sort(data, compare=lambda x, y: x <= y):
    length = len(data)

    for i in range(length):
        for j in range(0, length - i - 1):
            if not compare(data[j], data[j + 1]):
                data[j], data[j + 1] = data[j + 1], data[j]

    return data
```

## 选择排序
每一次遍历元素，都选择其余元素中最小或最大的那个元素，每一次都缩小遍历范围直到遍历完成。选择排序的时间复杂度仍然为`O(n^2)`，空间复杂度为`O(1)`。即使如此，选择排序的性能要略优于冒泡排序。

实现
```python
# 选择排序
def selection_sort(data, compare=lambda x, y: x <= y):
    length = len(data)

    for i in range(length):
        index = i
        for j in range(i + 1, length):
            if not compare(data[index], data[j]):
                index = j
        data[index], data[i] = data[i], data[index]

    return data
```

## 插入排序
插入排序的基本思想是将一个数插入一个已经排好序的序列中，并且在插入后仍然保持有序。实现上将每个序列最开始的部分视为有序，然后依次将后面的元素插入前面的有序列表。直到遍历所有元素，即得到一个全部有序的列表。插入排序的时间复杂度仍为`O(n^2)`，空间复杂度为`O(1)`。然而在数据量或数据基本有序时，插入排序将会拥有比冒泡和选择排序稍优异的性能。因此，经常将插入排序用作某些复合排序方法中的一部分。

实现
```python
# 插入排序
def ins_sort(data, compare=lambda x, y: x <= y):
    for index, value in enumerate(data):
        while index > 0:
            if not compare(data[index - 1], data[index]):
                data[index], data[index - 1] = data[index - 1], data[index]
            index -= 1
    return data
```

## 希尔排序
希尔排序基于插入排序。与插入排序每次比较交换最近的元素，依次向后遍历不同，希尔排序将序列分成几组，对这几组分别进行插入排序。然后缩小分组的间隔后再次分组，执行插入排序，直到分组间隔为1。可以看出，每一次分组，序列都将越来越有序，从而执行插入排序比较、交换的次数就会越来越少。因此，希尔排序的速度要优于O(n^2)，平均为O(nlog^2n)，最好为O(nlogn)。

从另一个方面看，排序的实质实际上是消除序列中的逆序数。冒泡、选择、插入等一次交换仅消除一个逆序数，而希尔排序一次交换会消除多个逆序数。因此希尔排序比普通插入排序更快。

```python
# 希尔排序
def shell_sort(data, compare=lambda x, y: x <= y):
    length = len(data)
    gap = length // 2

    while gap > 0:
        for i in range(gap, length, gap):
            current = data[i]

            while i >= gap and not compare(data[i - gap], current):
                data[i] = data[i - gap]
                i -= gap

            data[i] = current
        gap = gap // 2

    return data
```

## 快速排序
快速排序是分治法的体现。每次排序都选择一个基准元素，将序列分成独立的两部分，一部分中的所有元素始终小于基准元素，另一部分中的所有元素始终大于基准元素。对这两部分序列分别进行快速排序，直到序列不可再分。此时序列即是有序的。快速排序的平均时间复杂度为`O(nlogn)`，最坏情况为`O(n^2)`，空间复杂度为`O(logn)`（递归）。

两种实现
```python
# 快速排序1
def quick_sort1(data, begin=None, end=None, compare=lambda x, y: x <= y):
    from random import randint

    begin = begin if begin is not None else 0
    end = end if end is not None else (len(data) - 1)

    if begin >= end:
        return data

    key = randint(begin, end)
    data[begin], data[key] = data[key], data[begin]
    left = begin

    for index in range(begin + 1, end + 1):
        if compare(data[index], data[begin]):
            left += 1
            data[left], data[index] = data[index], data[left]
    data[left], data[begin] = data[begin], data[left]

    quick_sort1(data, begin, left - 1)
    quick_sort1(data, left + 1, end)

    return data


# 快速排序2
quick_sort2 = lambda data, compare=lambda x, y: x < y: \
    data if len(data) < 2 else \
    quick_sort2([a for a in data if compare(a, data[0])]) + \
    [data[0] * data.count(data[0])] + \
    quick_sort2([b for b in data if compare(data[0], b)])
```

## 归并排序
归并排序同运用了分治法的思想。归并排序将数据分为两部分，对每部分序列一次运用归并排序，直到不可再分，然后将各部分有序序列组合起来。最终返回的即为有序序列。归并排序的时间复杂度是`O(nlogn)`。

实现：
```python
def merge(data, i, j, k, compare):
    new_data = []
    data1, data2 = data[i:j + 1], data[j + 1:k + 1]
    a, b = 0, 0
    while a < len(data1) and b < len(data2):
        if compare(data1[a], data2[b]):
            new_data.append(data1[a])
            a += 1
        else:
            new_data.append(data2[b])
            b += 1
    new_data.extend(data1[a:])
    new_data.extend(data2[b:])
    data[i:k + 1] = new_data
    return data


def merge_sort(data, begin=None, end=None, compare=lambda x, y: x < y):
    begin = begin if begin is not None else 0
    end = end if end is not None else (len(data) - 1)

    if begin < end:
        mid = (begin + end) // 2

        merge_sort(data, begin, mid, compare)

        merge_sort(data, mid + 1, end, compare)

        merge(data, begin, mid, end, compare)

        return data
```

## 堆排序
参见上一篇文章

## 计数排序
计数排序是一种非比较的，稳定的线性时间排序算法。它将序列中的元素与一个数组中的位置对应。这个数组的下标是元素的值，这个位置储存的值是元素在新序列里所处于的位置。由n个元素组成，最大值为k的序列，首先构建一个长度为k的数组，遍历序列将它映射到数组之中，最后根据数组生成新的有序序列。因此，计数排序的时间复杂度与空间复杂度均为`O(n + k)`。

计数排序适用于容易将序列的值映射为整数，且跨度不太大的情况下。并且，序列排序经常被用于更复杂的排序（如基数排序）的基本排序方法。

实现:
```python
# 计数排序
def counting_sort(data, max_value=None):
    """
    @param data: 要排序的可迭代对象
    @param max: data里的最大值
    """
    max_value = max_value if max_value is not None else max(data)

    result = [None for _ in range(len(data))]
    position = [0 for _ in range(max_value + 1)]

    for value in data:
        position[value] += 1

    for index in range(1, max_value + 1):
        position[index] += position[index - 1]

    n = len(data) - 1
    while n >= 0:
        value = data[n]
        result[position[value] - 1] = value
        position[value] -= 1
        n -= 1

    return result
```
<!--MORE-->

## 基数排序
基数排序根据给定的基数，对序列元素的每一位依次进行计数排序。因为基数排序对p位元素的每一位都执行了计数排序，因此其时间复杂度为计数排序的p倍，即`O(p * (n + k))`。

与计数排序不同，只要可以将元素分成整形数字组成的几部分（如：字符串），就可以使用基数排序。

实现：
```python
# 基数排序
def radix_sort(data, exp=10, digit=5):
    from math import pow
    """
    @param data: 待排序的可迭代对象
    @param exp: 排序的基数
    @param digit: 数据的最大位数
    """
    for e in range(digit):
        result = [None for _ in range(len(data))]
        now_exp = pow(exp, e)
        position = [0 for _ in range(exp)]

        for value in data:
            bit = int(value / now_exp) % exp
            position[bit] += 1

        for index in range(1, exp):
            position[index] += position[index - 1]

        n = len(data) - 1
        while n >= 0:
            bit = int(data[n] / now_exp) % exp
            result[position[bit] - 1] = data[n]
            position[bit] -= 1
            n -= 1

        data = result

    return data
```

## 桶排序
桶排序将序列分到有限个数量的桶里，每个桶中的元素均处于某一个区间，对每个桶里的元素分别进行排序，最后再将每个桶组合起来。在序列中的值均匀分配的情况下，有n个元素，分到k个桶里，桶排序的时间复杂度为`O(n + k)`，空间复杂度为`O(n * k)`。

实现：
```python
# 桶排序
def bucket_sort(data, bucket_size=1, compare=lambda x, y: x <= y):
    min_value, max_value = int(min(data)), int(max(data))
    bucket_count = (max_value - min_value) // bucket_size + 1
    buckets = [[] for _ in range(bucket_count)]

    for value in data:
        buckets[(value - min_value) // bucket_size].append(value)

    index = 0
    for bucket in buckets:
        ins_sort(bucket, compare)
        for value in bucket:
            data[index] = value
            index += 1

    return data
```

## 各个排序算法的运行时间比较
分别测试了2000个元素和20000个随机元素下，各排序算法花费的时间：
```python
def compare(FAKE_COUNT=5000, FAKE_RANGE=10000):
    import time
    import random

    fake_data = [random.randint(0, FAKE_RANGE) for _ in range(FAKE_COUNT)]
    times = {}

    sort_methods = [bubble_sort, selection_sort, ins_sort, shell_sort,
                    quick_sort1, quick_sort2, merge_sort, counting_sort,
                    radix_sort, bucket_sort]

    for method in sort_methods:

        start = time.time()
        method(list(fake_data))
        end = time.time()

        times[method.__name__] = end - start

    sorted_time = sorted(times, key=lambda x: times[x])
    for key in sorted_time:
        print("{key:<15}:{time:<20}".format(key=key, time=times[key]))


if __name__ == '__main__':
    print('COUNT:2000\tSIZE:2000')
    compare(2000, 2000)
    print('COUNT:20000\tSIZE:20000')
    compare(20000, 20000)
```

结果为:
```
COUNT:2000      SIZE:2000
counting_sort  :0.002000093460083008
bucket_sort    :0.0020058155059814453
<lambda>       :0.009976387023925781
radix_sort     :0.014000892639160156
quick_sort1    :0.017019033432006836
merge_sort     :0.026001930236816406
shell_sort     :0.32696533203125
selection_sort :0.45195460319519043
ins_sort       :0.9020371437072754
bubble_sort    :1.868042230606079

COUNT:20000     SIZE:20000
counting_sort  :0.01299905776977539
bucket_sort    :0.025992870330810547
radix_sort     :0.08400774002075195
<lambda>       :0.12100505828857422
quick_sort1    :0.13498902320861816
merge_sort     :0.1459970474243164
shell_sort     :25.587008714675903
selection_sort :43.999064207077026
ins_sort       :70.03945851325989
bubble_sort    :84.87412595748901
```


## 碎碎念
诶，六月炎炎近酷暑，吹着空调写代码╮（╯＿╰）╭