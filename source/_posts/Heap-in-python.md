---
title: 堆排序python实现
date: 2018-06-17 22:28:59
tags:
    - Python
    - 算法
categories: 算法
---
## 堆
堆是一种基于树的数据结构，其父节点总是大于（最大堆）或小于（最小堆）其子节点，并且其根节点总是树中最小（或最大）的那个节点。

堆排序常被用来实现`优先队列`，用于按给定的因子排定元素的优先级。而其本身最常采用的实现方式是扁平储存的二叉树。在二叉树实现的堆中，一个节点的兄弟节点并无特定的关系。唯一的关系存在于父节点和子结点中。
<!--MORE-->

由于堆的二叉树总会是一个完全二叉树，且是用列表的方式扁平储存二叉树以实现堆，所以，在堆的列表中，序号为 n 的节点有以下几个特征：

1. 其父节点为 `(n - 1) // 2` （取整）。
2. 其左子节点为 `n * 2 + 1`。
3. 其右子节点为 `n * 2 + 2`。

## 操作
### 插入
对堆执行插入操作，只需将其推入列表尾部，然后逐一与其父节点进行比较，如果逆序就交换。直到不再交换，则节点已经在正确为止。

关键代码：
```python
    def heap_up(self, index):
        parent = self.parent(index)
        while True:
            if not self.compare(self._heap[parent], self._heap[index]):
                self._heap[parent], self._heap[index] = \
                    self._heap[index], self._heap[parent]
            else:
                break
            index = parent
            parent = self.parent(index)

            if index == parent:
                break

def insert(self, node):
        self._heap.append(node)
        self.size += 1
        self.heap_up(self.size - 1)
```

### 提取
提取堆中最大的一个元素，只需提取第一个元素，然后用最后一个元素覆盖第一个元素。再逐一将这个元素与和这个元素差距最大的子元素比较，如果逆序就交换。直到不再交换为止，删除最后一个元素，返回提取出来的第一个元素。操作完毕。

关键代码：
```python
 def heap_down(self, index=0):
        while True:
            child = self.max_child(index)
            if not child:
                break
            else:
                if self.compare(self._heap[child], self._heap[index]):
                    self._heap[child], self._heap[index] = \
                        self._heap[index], self._heap[child]
                    index = child
                else:
                    break

def extract(self):
        top = self._heap[0]
        self._heap[0] = self._heap[self.size - 1]
        self.heap_down()
        self._heap.pop()
        self.size -= 1
        return top
```

<!--MORE-->

## 参考
《算法精解-C语言描述》

https://en.wikipedia.org/wiki/Heap_(data_structure)

## 完整代码
托管在gist上：

https://gist.github.com/Arianxx/17d97f0bad4512aae483395bba46a5f9

<script src="https://gist.github.com/Arianxx/17d97f0bad4512aae483395bba46a5f9.js"></script>
