---
title: cpython3.7 dict 对象的内在原理
date: 2018-12-30 15:31:50
tags: 
    - python
    - 源码
categories: python
---
众所周知，python 中有一个应用得极其广泛内建对象——dict(字典)。cpython 解释器本身，以及大量的 python 程序，都依赖于 dict 对象。因此，dict 对象在 python 中设计得极其高效，其插入、删除、查询等操作的时间复杂度都是O(1)。

dict 对象可以这样使用:
```python
>>> scores = {'Mike': 90, 'Jack': 100}
>>> scores['Ariana'] = 0
>>> scores['Jack']
100
>>> scores['Tim']
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
KeyError: 'Tim'
```

本文将从 cpython3.7 源码的角度出发，探讨 dict 对象的内部原理。主要将探讨以下几个内容：

- dict 对象的结构、组成
- dict 解决哈希冲突的方式
- cpython 对 dict 的内部优化，如缓冲池、split table
- 遍历 dict 保持插入顺序的原理

本文的剖析基于 https://github.com/python/cpython/blob/bb86bf4c4eaa30b1f5192dab9f389ce0bb61114d/Objects/dictobject.c 这份源码。
<!--MORE-->

## 哈希表简述
cpython 采用哈希表来实现 dict（与之不同的是，c++ 采用红黑树来实现 map）。因此，想要了解 cpython 的 dict 实现，需要先对哈希表这个数据结构有所了解。

哈希表是一种实现了[关联数组](https://en.wikipedia.org/wiki/Associative_array)抽象数据类型的，键值形式的数据结构。哈希表通常利用一个**哈希函数**，将一个给定的键映射为一个值，这个值反映了与键对应的数据的储存位置。例如，将一个数组作为数据的储存位置，那么，哈希函数就将键映射为这个数组中键对应数据的下标。以后想要查找这个数据时，就不用从头遍历数组，而是直接哈希键取得下标，使得查询的时间由O(n)缩短到O(1)。

由于我们最终会将数据储存在一个确定大小的空间内，而待哈希的值又是源源不断的。因此，我们难以避免有多个不同的数据被哈希函数哈希到同一个数据地址的情况，这种情况就叫做发生了[冲突](https://en.wikipedia.org/wiki/Collision_(computer_science))。衡量哈希表的冲突率的一个指标是哈希表的**负载因子**，它等于哈希表已使用的空间除以哈希表的总空间。直观上来说，它反映了哈希表中的一个位置平均储存的数据个数。当负载因子的值大于 2/3 时，哈希发生冲突的概率就将大大增加。因此，后面我们会看到，当 dict 中的哈希表负载因子大于 2/3 时，解释器会重新分配哈希表的大小使其负载因子小于 2/3。

我们通常使用**链地址法**或**开放寻址法**来解决哈希冲突。因为链地址法会带来分配链表的开销，而 cpython 中 dict 又运用得极其普遍，因此 dict 采用开放寻址法来实现哈希表（与之不同的是，go 使用链地址法解决哈希冲突）。dict 原本的注释说：

>Open addressing is preferred over chaining since the link overhead for
chaining would be substantial (100% with typical malloc overhead)

当发生哈希冲突时，dict 中的开放寻址法将会依赖哈希值使用二次探查函数生成一段探查序列，这个探查序列覆盖了整个哈希表的下标取值。

对于开放寻址法来说，当插入值发生哈希冲突时，会依照探查序列将值和键一起储存在之后的某个空位置上。当查找某个发生冲突的值时，顺着探查序列查看储存的键是否和待查找的键相同，如果最后查找到一个储存了 null 的槽，就意味着对应的键不存在于表中，指示查找结束。当删除某个发生冲突的键时，不能直接将那个槽置为 null，因为 null 指示了结束查找。因此，在删除一个值后，通常将这个槽设为 **dummy**，指示查找算法应该继续查找下去直到遇到一个 null。

值得注意的是，当哈希函数选择不当时，哈希值可能堆积在一起从而产生一次聚集或二次聚集的现象。这会使落在这个聚集区间内的哈希值总要探查多次才能找到正确的位置，从而极大的降低哈希的效率，特别是对于开放寻址法来说。可见，哈希函数的选择对哈希表至关重要。虽然如此，cpython 中的哈希算法独立于哈希表实现，本文将精力聚焦在 dict 实现本身上，对哈希算法暂不做更多关注。

关于哈希表的更多信息可以参阅 [Hash Table](https://en.wikipedia.org/wiki/Hash_table)。

## dict 的结构

#### PyDictKeyEntry
首先分析 dict 的数据结构。前面说过，dict 会将数据储存在一个哈希表中。这个哈希表中的元素类型，就是 PyDictKeyEntry 了:
```c
typedef struct {
    // 缓存的 key 的 hash
    Py_hash_t me_hash;
    PyObject *me_key;
    PyObject *me_value; 
} PyDictKeyEntry;
```
每一次向 dict 中插入一个数据，实际上就会向哈希表中插入一个 PyDictKeyEntry。PyDictKeyEntry 中不单储存了指向插入数据的指针(`PyObject *me_value`)，还储存了这个数据对应的键(`PyObject *me_key`)，以及键所对应的哈希(`Py_hash_t me_hash`)。

那么，这里的 Py_hash_t 类型是什么呢？
```c
typedef ssize_t Py_ssize_t;
typedef Py_ssize_t Py_hash_t;
```
可见，Py_hash_t 实际上是 `ssize_t` 类型。ssize_t 类型的简介可以在[这里](https://jameshfisher.com/2017/02/22/ssize_t.html)看到。简单来说，就是一个可以为 -1 的 size_t 类型。

#### PyDictKeysObject
PyDictKeysObject 是 dict 中储存哈希表的结构，它的定义如下:
```c
struct _dictkeysobject {
    // 对这个 PyDictKeysObject 的引用
    // 对于 split table，引用必须为1
    Py_ssize_t dk_refcnt;

    // 实际哈希表（dk_indices）的大小，其值必须为 2 的幂
    Py_ssize_t dk_size;

    /* typedef Py_ssize_t (*dict_lookup_func)
        (PyDictObject *mp, PyObject *key, Py_hash_t hash, PyObject **value_addr);
    */
    // Function to lookup in the hash table (dk_indices)
    dict_lookup_func dk_lookup;

    // dk_entries 中可用条目的数目。
    // 每次插入值，dk_usable 都会减少，删除不会增加（删除使一个槽变为 dummy）
    // 当 dk_usable 减少到 0，会引发哈希表内存空间的重新分配，删除其中所有 dummy
    /* Number of usable entries in dk_entries. */
    Py_ssize_t dk_usable;

    // 每次插入，其值增加
    /* Number of used entries in dk_entries. */
    Py_ssize_t dk_nentries;

    // 实际的哈希表，类型随哈希表的大小而变
    /* Actual hash table of dk_size entries. It holds indices in dk_entries,
       or DKIX_EMPTY(-1) or DKIX_DUMMY(-2).

       Indices must be: 0 <= indice < USABLE_FRACTION(dk_size).

       The size in bytes of an indice depends on dk_size:

       - 1 byte if dk_size <= 0xff (char*)
       - 2 bytes if dk_size <= 0xffff (int16_t*)
       - 4 bytes if dk_size <= 0xffffffff (int32_t*)
       - 8 bytes otherwise (int64_t*)

       Dynamically sized, SIZEOF_VOID_P is minimum. */
    char dk_indices[];  /* char is required to avoid strict aliasing. */

    // dk_entries 不显示存在于定义里，新建 PyDictKeysObject，会分配与之对应的内存空间
    /* "PyDictKeyEntry dk_entries[dk_usable];" array follows:
       see the DK_ENTRIES() macro */
};
typedef struct _dictkeysobject PyDictKeysObject;
```
令人疑惑的是，前面说过，PyDictKeysObject 中储存了实际的哈希表，PyDictKeyEntry 是哈希表储存数据的元素类型,然而在这里的定义里面，为什么没有见到对应的 PyDictKeyEntry 数组作为哈希表，却说`char dk_indices[]`是实际的哈希表呢？

这是因为，在 cpython3.7 的实现里面，对 dict 中的键值做了两重映射。cpython3.6 以前，PyDictKeysObject 储存的哈希表就是 PyDictKeyEntry\* 数组，键的哈希值直接代表了数据在哈希表中的位置。从 cpython3.6 开始，PyDictKeysObject 中储存哈希表的实际类型变成了 char dk_indices\[\]，另外用 PyDictKeyEntry 数组储存数据。dk_indices 里面储存的值不是真实数据 PyDictKeyEntry，而是它在 PyDictKeyEntry 数组里面的位置。

在 cpython3.6 以前，哈希表就是 PyDictKeyEntry 数组类型，因此每个键的哈希都映射了这个数组的位置。这样当遍历 dict 时，实际是遍历这个 PyDictKeyEntry\* 哈希表，当然无法保持有序。cpython3.6 以后，每插入一个值时，实际是**顺序**将值插入这个额外的 PyDictKeyEntry\* 数组，然后将这个值的位置储存在哈希表 dk_indices 里。这样，遍历 dict，遍历的不是哈希表 dk_indices，而是这个 PyDictKeyEntry\*，而 PyDictKeyEntry\* 中的数据已经是有序的。这里的 PyDictKeyEntry\* 就是注释中所说的 `PyDictKeyEntry dk_entries[dk_usable]`。这就是 cpython3.6 以后**遍历 dict 保持键插入顺序**的原理。

那么为什么在 PyDictKeysObject 里面找不到对应的 dk_entries 字段呢？

首先考察 dk_indices。dk_indices 中储存的是数据的位置，因此我们必须为 dk_indices 分配足以容下这个数量的值的内存空间。考虑到实际使用中 dict 可以有不同数量的键，有时数量差距极大。因此这里使 dk_indices 的类型随哈希表的大小而变化以节约内存空间。这是解释器级别对于 dict 的优化。

dk_indices 和 dk_entries 都是可变大小的，而 c 结构体中变长的数组只能放于结构体的最后一个元素，因此这里结构体的定义中只列出了 dk_indices，实际的 dk_entries 的内存空间直接在新建时一起分配。

下面我们考察注释里面提到的 DK_ENTRIES：
```c
#define DK_SIZE(dk) ((dk)->dk_size)

// 根据哈希表的大小，判断哈希表每个元素占据的字节大小
#define DK_IXSIZE(dk)                          \
    (DK_SIZE(dk) <= 0xff ?                     \
        1 : DK_SIZE(dk) <= 0xffff ?            \
            2 : sizeof(int32_t))

// 将 dk_indices 指针转换为int8_t，每个元素一字节。这样 DK_SIZE(dk) * DK_IXSIZE(dk) 
// 就恰是 dk_entreis 相对于 dk_indices 的偏移地址
#define DK_ENTRIES(dk) \
    ((PyDictKeyEntry*)(&((int8_t*)((dk)->dk_indices))[DK_SIZE(dk) * DK_IXSIZE(dk)]))
```

这里 DK_SIZE 是 PyDictKeysObject 中哈希表 dk_indices 的元素个数，DK_IXSIZE 是每个元素占有的字节数（注意到这里占有的字节数随哈希表大小而变化）。现在，我们终于明白了，dk_entries 在 PyDictKeysObject 紧紧跟在 dk_indices 后面。DK_ENTRIES 宏就根据这一点动态计算出 dk_entries 的内存地址，转换类型供我们使用。

#### PyDictObject
最终，暴露给解释器的对象是 PyDictObject：
```c
typedef struct {
    PyObject_HEAD

    // 字典中的元素个数，插入加一，删除减一
    // len 即依赖这个字段
    /* Number of items in the dictionary */
    Py_ssize_t ma_used;

    /* Dictionary version: globally unique, value change each time
       the dictionary is modified */
    uint64_t ma_version_tag;

    PyDictKeysObject *ma_keys;

    // 储存 split table 的数据
    PyObject **ma_values;
} PyDictObject;
```
PyDictObject 有 PyObject_HEAD 宏使其可以作为 cpython 对象而使用。此外还有一个`PyObject **ma_values`，这个字段是为了实现 split table，共用键对象，关于这一点我们之后再做剖析。

## 操作哈希表
下面我们考察 dict 中是如何直接操作哈希表的。暴露给用户的 api 都是对这些直接操作哈希表的函数的封装。

#### 读取、置位哈希表
```c
/* lookup indices.  returns DKIX_EMPTY, DKIX_DUMMY, or ix >=0 */
static inline Py_ssize_t
dk_get_index(PyDictKeysObject *keys, Py_ssize_t i)
{
    Py_ssize_t s = DK_SIZE(keys);
    Py_ssize_t ix;

    // 根据哈希表的大小，将 dk_indices 指针转换为不同类型的指针，得到其储存的数据
    if (s <= 0xff) {
        int8_t *indices = (int8_t*)(keys->dk_indices);
        ix = indices[i];
    }
    else if (s <= 0xffff) {
        int16_t *indices = (int16_t*)(keys->dk_indices);
        ix = indices[i];
    }
    else {
        int32_t *indices = (int32_t*)(keys->dk_indices);
        ix = indices[i];
    }
    assert(ix >= DKIX_DUMMY);
    return ix;
}
```
前面说过，dk_indices 是实际的哈希表，可见，dk_get_index 就是得到位置为哈希表中下标为 i 处储存的位置。

还有一个与之相关的函数：
```c
static inline void
dk_set_index(PyDictKeysObject *keys, Py_ssize_t i, Py_ssize_t ix)
```
将哈希表下标为 i 的元素设置为 ix。

#### 查询哈希表
```c
#define DK_MASK(dk) (((dk)->dk_size)-1)
#define PERTURB_SHIFT 5

static Py_ssize_t
lookdict(PyDictObject *mp, PyObject *key,
         Py_hash_t hash, PyObject **value_addr)
{
    size_t i, mask, perturb;
    PyDictKeysObject *dk;
    PyDictKeyEntry *ep0;

top:
    dk = mp->ma_keys;
    // ep0: 实际储存数据的数组
    ep0 = DK_ENTRIES(dk);
    // 掩码，使哈希值落入合理范围内
    mask = DK_MASK(dk);
    // perturb: 用于哈希冲突下的二次探查
    perturb = hash;
    // 初始探查位置
    i = (size_t)hash & mask;

    for (;;) {
        Py_ssize_t ix = dk_get_index(dk, i);
        if (ix == DKIX_EMPTY) {
            // 对应位置没有值，指示探查结束
            *value_addr = NULL;
            return ix;
        }
        if (ix >= 0) {
            // 获得 ix 位置处储存的数据
            PyDictKeyEntry *ep = &ep0[ix];
            assert(ep->me_key != NULL);
            if (ep->me_key == key) {
                // 正是此次要寻找的数据
                *value_addr = ep->me_value;
                return ix;
            }
            if (ep->me_hash == hash) {
                // 键不直接相等，但哈希相等，可能是因为键是 python 对象，用 python 的比较方法
                PyObject *startkey = ep->me_key;
                Py_INCREF(startkey);
                int cmp = PyObject_RichCompareBool(startkey, key, Py_EQ);
                Py_DECREF(startkey);
                if (cmp < 0) {
                    // 如果 cmp 小于0，表示比较过程中发生错误
                    *value_addr = NULL;
                    return DKIX_ERROR;
                }
                if (dk == mp->ma_keys && ep->me_key == startkey) {
                    // PyObject_RichCompareBool 可能会调用用户定义的特殊方法（__lt__ 之类的），这些方法可能会改变字典
                    // 这里通过检查 key 来判断要操作的元素是否在比较过程中被改变
                    if (cmp > 0) {
                        *value_addr = ep->me_value;
                        return ix;
                    }
                }
                else {
                    /* The dict was mutated, restart */
                    goto top;
                }
            }
        }
        // 冲突，查看探查序列下一个位置
        perturb >>= PERTURB_SHIFT;
        i = (i*5 + perturb + 1) & mask;
    }
    Py_UNREACHABLE();
}
```
lookdict 是实际查找哈希表的函数，使用这个函数，需要先计算出 key 对应的哈希。若查找到，返回值会被储存在 value_addr,否则其为 NULL。

它会根据给定的哈希生成一串探查序列，然后一次查找这些探查序列对应位置的数据，如果储存的 key 和 hash 和我们要查找的 key 和 hash 相等，就把数据储存在传入的 value_addr 指针里面，否则储存 null。

可见 lookdict 在 key 不直接相等时调用了 PyObject_RichCompareBool 函数，这会带来额外的开销。cpython 为预先知道 key 只能为 unicode object 的情况下提供了 lookdict_unicode 函数，去除了对 PyObject_RichCompareBool 的调用，使用更高效的 unicode_eq 函数。

当新建一个 dict 时，cpython 会将默认的查询函数设置为 lookdict_unicode，当插入一个非 unicode object 的键时，就会使查询函数退化为 lookdict。

除此之外，cpython 还提供了 lookdict_unicode_nodummy 函数，逻辑与 lookdict_unicode 一样，只是添加了 ix 不为 dummy 的 assert。当调用 dictresize 时，会删除 dict 中的 dummy，并将查找函数设置为它。之后当插入非 unicode object 时，就会退化为 lookdict。

#### 插入哈希表
直接插入哈希表的源码如下：
```c
static uint64_t pydict_global_version = 0;
#define DICT_NEXT_VERSION() (++pydict_global_version)

/* 在知道有对应 hash 的空位的情况下，返回哈希表中那个空位的位置 
 * hash 代表了哈希表的下标，为什么不直接只用呢？因为可能发生哈希冲突。
 */
static Py_ssize_t
find_empty_slot(PyDictKeysObject *keys, Py_hash_t hash)
{
    assert(keys != NULL);

    const size_t mask = DK_MASK(keys);
    size_t i = hash & mask;
    Py_ssize_t ix = dk_get_index(keys, i);
    for (size_t perturb = hash; ix >= 0;) {
        // 直到 ix 小于 0 时终止，也就是说为 empty 或 dummy
        perturb >>= PERTURB_SHIFT;
        i = (i*5 + perturb + 1) & mask;
        ix = dk_get_index(keys, i);
    }
    return i;
}

static int
insertdict(PyDictObject *mp, PyObject *key, Py_hash_t hash, PyObject *value)
{
    PyObject *old_value;
    PyDictKeyEntry *ep;

    // split table，稍后解释
    if (mp->ma_values != NULL && !PyUnicode_CheckExact(key)) {
        // 调整哈希表大小，使 split table 转化为 combined table
        if (insertion_resize(mp) < 0)
            goto Fail;
    }

    Py_ssize_t ix = mp->ma_keys->dk_lookup(mp, key, hash, &old_value);
    if (ix == DKIX_ERROR)
        goto Fail;

    if (ix == DKIX_EMPTY) {
        /* Insert into new slot. */
        assert(old_value == NULL);
        if (mp->ma_keys->dk_usable <= 0) {
            /* Need to resize. */
            // insertion_resize： 调整哈希表大小使其符合 2/3 的装载率
            if (insertion_resize(mp) < 0)
                goto Fail;
        }
        // hashpos 哈希表中待插入位置的下标
        Py_ssize_t hashpos = find_empty_slot(mp->ma_keys, hash);
        // dk_nentries: dk_entries 中已使用元素的个数
        // 这里获得下一个元素，实现顺序插入
        // 稍后会看到 cpython 在调用 insertion_resize时，会清除 dk_entries 中的空元素
        ep = &DK_ENTRIES(mp->ma_keys)[mp->ma_keys->dk_nentries];
        dk_set_index(mp->ma_keys, hashpos, mp->ma_keys->dk_nentries);
        ep->me_key = key;
        ep->me_hash = hash;
        if (mp->ma_values) {
             // split table
            assert (mp->ma_values[mp->ma_keys->dk_nentries] == NULL);
            mp->ma_values[mp->ma_keys->dk_nentries] = value;
        }
        else {
            ep->me_value = value;
        }
        // 新插入元素调整各项大小，删除元素不再调整，从而使 ix 为 dummy 时的操作
        // 和 ix 已经有元素的操作一致
        mp->ma_used++;
        mp->ma_version_tag = DICT_NEXT_VERSION();
        mp->ma_keys->dk_usable--;
        mp->ma_keys->dk_nentries++;
        return 0;
    }

    // 为 dummy 或 已经存在的元素，直接设置值
    if (_PyDict_HasSplitTable(mp)) {
        // split table
        mp->ma_values[ix] = value;
        if (old_value == NULL) {
            /* pending state */
            assert(ix == mp->ma_used);
            mp->ma_used++;
        }
    }
    else {
        assert(old_value != NULL);
        DK_ENTRIES(mp->ma_keys)[ix].me_value = value;
    }

    mp->ma_version_tag = DICT_NEXT_VERSION();
    return 0;

Fail:
    Py_DECREF(value);
    Py_DECREF(key);
    return -1;
}
```
insertdict 调用 lookdict 查看对应的键和哈希是否已经有值，如果没有就获取 dk_entries 中的下一个待插入条目并赋值，调用 dk_set_index 将它的位置设置到哈希表里。除此之外，同步更新了 ma_used、ma_version_tag 等的数据。

insertdict 是直接插入 dict 中哈希表的内部函数，许多其它暴露出来的 api 都会调用它。

#### 删除键值
最内部的函数是 delitem_common，它的源码如下：
```c
// lookdict_index 获取在 dk_entries 中哈希为 hash，位置为 index 处的数据
// 对应在哈希表 dk_indices 中的位置
static Py_ssize_t
lookdict_index(PyDictKeysObject *k, Py_hash_t hash, Py_ssize_t index)
{
    size_t mask = DK_MASK(k);
    size_t perturb = (size_t)hash;
    size_t i = (size_t)hash & mask;

    for (;;) {
        Py_ssize_t ix = dk_get_index(k, i);
        if (ix == index) {
            return i;
        }
        if (ix == DKIX_EMPTY) {
            return DKIX_EMPTY;
        }
        perturb >>= PERTURB_SHIFT;
        i = mask & (i*5 + perturb + 1);
    }
    Py_UNREACHABLE();
}


// hash: 待删除元素的 hash; ix: 待删除元素位于 dk_entries 中的位置
static int
delitem_common(PyDictObject *mp, Py_hash_t hash, Py_ssize_t ix,
               PyObject *old_value)
{
    PyObject *old_key;
    PyDictKeyEntry *ep;

    // hashpos: 待删除数据在哈希表中的下标
    Py_ssize_t hashpos = lookdict_index(mp->ma_keys, hash, ix);
    assert(hashpos >= 0);

    mp->ma_used--;
    mp->ma_version_tag = DICT_NEXT_VERSION();
    ep = &DK_ENTRIES(mp->ma_keys)[ix];
    // 设置对应位置为 dummy，不改变 dk_nentreis，不调整 dk_usable
    dk_set_index(mp->ma_keys, hashpos, DKIX_DUMMY);
    old_key = ep->me_key;
    ep->me_key = NULL;
    ep->me_value = NULL;
    Py_DECREF(old_key);
    Py_DECREF(old_value);
    return 0;
}
```

暴露给用户的 PyDict_DelItem 函数先计算出给定键的哈希，然后调用 lookdict 查看对应的键是否存在于哈希表中，如果存在，才会调用 delitem_common 真正删除其值。

#### 调整哈希表
前面看到，当插入元素时如果空间不够，会调整哈希表大小：
```c
// 使负载因子在 2/3 附近，需要调整的大小
#define GROWTH_RATE(d) ((d)->ma_used*3)

static int
insertion_resize(PyDictObject *mp)
{
    return dictresize(mp, GROWTH_RATE(mp));
}
```

dictresize 里面有这样一个代码片段：
```c
PyDictKeyEntry *ep = oldentries;
for (Py_ssize_t i = 0; i < numentries; i++) {
    while (ep->me_value == NULL)
        ep++;
    newentries[i] = *ep++;
}
```
这里`while (ep->me_value == NULL) ep++;`使得调整后的 dk_entries 是连续的，其中不含 dummy。设置完 dk_entries 后，dictresize 会根据 dk_entries 中储存的键值，通过 lookdict 查找 dk_indices 的空位，然后使用 dk_set_index 反向设置哈希表中的值。从而重新建立对应关系。

dictresize 中还有其它一些细碎逻辑，就不一一剖析了。

## 相关API
提供给用户的 API 函数大体上都是对于几个直接操作哈希表的函数的封装。本处将列举几个相关的常用API。
#### PyDict_GetItem
源码如下:
```c
PyObject *
PyDict_GetItem(PyObject *op, PyObject *key)
{
    Py_hash_t hash;
    Py_ssize_t ix;
    PyDictObject *mp = (PyDictObject *)op;
    PyThreadState *tstate;
    PyObject *value;

    if (!PyDict_Check(op))
        return NULL;
    if (!PyUnicode_CheckExact(key) ||
        (hash = ((PyASCIIObject *) key)->hash) == -1)
    {
        // 如果不是 unicode，或者是 unicode 但其内部没有缓存的 hash，就重新计算
        hash = PyObject_Hash(key);
        if (hash == -1) {
            PyErr_Clear();
            return NULL;
        }
    }

    // dk_lookup 默认为 lookdict_unicode
    // 如果 key 不是unicode，就会退化到 lookdict
    ix = (mp->ma_keys->dk_lookup)(mp, key, hash, &value);
    if (ix < 0) {
        PyErr_Clear();
        return NULL;
    }
    return value;
}
```
可见，提供的 PyDict_GetItem 使用了 lookdict 及其相关函数。

#### PyDict_DelItem
源码如下:
```c
int
PyDict_DelItem(PyObject *op, PyObject *key)
{
    Py_hash_t hash;
    assert(key);
    if (!PyUnicode_CheckExact(key) ||
        (hash = ((PyASCIIObject *) key)->hash) == -1) {
        // 获得 hash 值
        hash = PyObject_Hash(key);
        if (hash == -1)
            return -1;
    }

    return _PyDict_DelItem_KnownHash(op, key, hash);
}

int
_PyDict_DelItem_KnownHash(PyObject *op, PyObject *key, Py_hash_t hash)
{
    Py_ssize_t ix;
    PyDictObject *mp;
    PyObject *old_value;

    if (!PyDict_Check(op)) {
        PyErr_BadInternalCall();
        return -1;
    }
    assert(key);
    assert(hash != -1);
    mp = (PyDictObject *)op;
    ix = (mp->ma_keys->dk_lookup)(mp, key, hash, &old_value);
    if (ix == DKIX_ERROR)
        return -1;
    if (ix == DKIX_EMPTY || old_value == NULL) {
        // 删除不存在的元素会抛出错误
        _PyErr_SetKeyError(key);
        return -1;
    }

    // Split table doesn't allow deletion.  Combine it.
    if (_PyDict_HasSplitTable(mp)) {
        // 从 split table 中删除元素会使它转换为 combine table
        if (dictresize(mp, DK_SIZE(mp->ma_keys))) {
            return -1;
        }
        ix = (mp->ma_keys->dk_lookup)(mp, key, hash, &old_value);
        assert(ix >= 0);
    }

    return delitem_common(mp, hash, ix, old_value);
}
```
PyDict_DelItem 是在计算出给定键的哈希值并寻找到对应数据储存在 dk_entreis 下标后，调用 delitem_common 实现删除操作的。

#### PyDict_Contains
PyDict_Contains 函数的源码如下：
```c
int
PyDict_Contains(PyObject *op, PyObject *key)
{
    Py_hash_t hash;
    Py_ssize_t ix;
    PyDictObject *mp = (PyDictObject *)op;
    PyObject *value;

    if (!PyUnicode_CheckExact(key) ||
        (hash = ((PyASCIIObject *) key)->hash) == -1) {
        hash = PyObject_Hash(key);
        if (hash == -1)
            return -1;
    }
    ix = (mp->ma_keys->dk_lookup)(mp, key, hash, &value);
    if (ix == DKIX_ERROR)
        return -1;
    return (ix != DKIX_EMPTY && value != NULL);
}
```
简单的调用了 dk_lookup 函数，默认就是 lookdict_unicode 函数。

## 内部优化
#### dict 缓存池
为了避免频繁申请、释放内存，导致过多的系统调用，在 cpython 中，很多内建对象都有自己的缓存池。例如，整数有针对小整数的缓存池，字符串有针对短字符串的缓存池，同样，dict 也有自己的缓存池：
```c
#define PyDict_MAXFREELIST 80

static PyDictObject *free_list[PyDict_MAXFREELIST];
static int numfree = 0;
static PyDictKeysObject *keys_free_list[PyDict_MAXFREELIST];
static int numfreekeys = 0;
```
可见，dict 使用数组实现缓存池，并且 PyDictObject 和 PyDictKeysObject 各有一个数组。

我们可以在新建 PyDictKeysObject 的函数 new_keys_object 中看到这样的代码片段：
```c
if (size == PyDict_MINSIZE && numfreekeys > 0) {
        // 如果 size 符合 PyDict_MINSIZE，且 numfreekeys 有剩余，就直接使用缓存池中的对象
        dk = keys_free_list[--numfreekeys];
    }
    else {
        // 如果不能从缓存池中获取，就分配一段新内存。
        // 这里分配的大小是根据要哈希表的大小动态计算的
        dk = PyObject_MALLOC(sizeof(PyDictKeysObject)
                             + es * size
                             + sizeof(PyDictKeyEntry) * usable);
        if (dk == NULL) {
            PyErr_NoMemory();
            return NULL;
        }
    }
```
其中，PyDict_MINSIZE 默认情况下为 8，size 为新建的 PyDictKeysObject 里的哈希表大小。

当然，新建时能够从缓存池中获取，在销毁时也能归于缓存池。在销毁 PyDictKeysObject 的函数可以见到：
```c
static void
free_keys_object(PyDictKeysObject *keys)
{
    PyDictKeyEntry *entries = DK_ENTRIES(keys);
    Py_ssize_t i, n;
    for (i = 0, n = keys->dk_nentries; i < n; i++) {
        // 一一减少储存数据的引用计数
        // 当引用计数为0，会触发各自的 delloc 函数
        Py_XDECREF(entries[i].me_key);
        Py_XDECREF(entries[i].me_value);
    }
    if (keys->dk_size == PyDict_MINSIZE && numfreekeys < PyDict_MAXFREELIST) {
        keys_free_list[numfreekeys++] = keys;
        return;
    }
    PyObject_FREE(keys);
}
```
如果符合条件，使用`keys_free_list[numfreekeys++] = keys;`使对象回到缓存池。否则才调用 PyObject_FREE 销毁 keys。

#### split table
前面说过，PyDictKeysObject 中的 dk_indices 是实际的哈希表，而 dk_entries 是实际储存数据的区域。这样的构造使得每个 dict 内都各有一个 PyDictKeysObject 对象用来记录键值。然而，在解释器内部使用到了许多键是 unicode object 且插入顺序相同的 dict 对象，它们之间只有值不同。cpython 为这种情况设计了一种键值分开储存的 split table dict。split table 能够在唯有值不同的多个 dict 中共享 PyDictKeysObject 对象。

回想起前面的 PyDictObject 对象:
```c
typedef struct {
    PyObject_HEAD

    /* Number of items in the dictionary */
    Py_ssize_t ma_used;

    /* Dictionary version: globally unique, value change each time
       the dictionary is modified */
    uint64_t ma_version_tag;

    PyDictKeysObject *ma_keys;

    PyObject **ma_values;
} PyDictObject;
```
其中有一个未曾被我们注意的字段 `PyObject **ma_values;`，这是一个指向 PyObject* 的指针，实际就是在 split table dict 里面用来存放 dk_entries 的字段。

可以使用 make_keys_shard 将 combined table 转换为 split table:
```c
#define USABLE_FRACTION(n) (((n) << 1)/3)
#define new_values(size) PyMem_NEW(PyObject *, size)

static PyDictKeysObject *
make_keys_shared(PyObject *op)
{
    Py_ssize_t i;
    Py_ssize_t size;
    PyDictObject *mp = (PyDictObject *)op;

    if (!PyDict_CheckExact(op))
        return NULL;
    if (!_PyDict_HasSplitTable(mp)) {
        PyDictKeyEntry *ep0;
        PyObject **values;
        if (mp->ma_keys->dk_lookup == lookdict) {
            // 新建 dict 时默认的查询函数是 lookdict_unicode
            // 如果查询函数是 lookdict，说明插入了非 unicode object 键，使 lookdict_unicode 退化为它
            // 而 split table 的键只能是 unicode object
            return NULL;
        }
        else if (mp->ma_keys->dk_lookup == lookdict_unicode) {
            /* Remove dummy keys */
            // dictresize 会删除 dk_indices 和 dk_entreis 中的 dummy
            // 同时将 dk_lookup 设置为 lookdict_unicode_nodummy
            if (dictresize(mp, DK_SIZE(mp->ma_keys)))
                return NULL;
        }
        assert(mp->ma_keys->dk_lookup == lookdict_unicode_nodummy);
        /* Copy values into a new array */
        ep0 = DK_ENTRIES(mp->ma_keys);
        // 一个 dict 的负载因子总会小于 2/3，因此这里使用 USABLE_FRACTION 来获得新 dict 的最大大小
        size = USABLE_FRACTION(DK_SIZE(mp->ma_keys));
        values = new_values(size);
        if (values == NULL) {
            PyErr_SetString(PyExc_MemoryError,
                "Not enough memory to allocate new values array");
            return NULL;
        }
        for (i = 0; i < size; i++) {
            values[i] = ep0[i].me_value;
            ep0[i].me_value = NULL;
        }
        // lookdict_split 其实和 lookdict_unicode_nodummy 的逻辑一样
        // 只是最后数据从 ma_values 里面拿
        mp->ma_keys->dk_lookup = lookdict_split;
        mp->ma_values = values;
    }
    DK_INCREF(mp->ma_keys);
    return mp->ma_keys;
}
```

当我们拥有一个 split table dict 对象之后，就可以用 new_dict_with_shared_keys 函数建立另一个共享了这个对象 keys 对象的 dict 对象：
```c
// new_dict 使用给定的 keys 对象新建一个 dict 对象，并且将 ma_values 设置为 values
static PyObject *
new_dict(PyDictKeysObject *keys, PyObject **values)
{
    PyDictObject *mp;
    assert(keys != NULL);
    if (numfree) {
        // 直接从缓存池从拿一个对象
        mp = free_list[--numfree];
        assert (mp != NULL);
        assert (Py_TYPE(mp) == &PyDict_Type);
        _Py_NewReference((PyObject *)mp);
    }
    else {
        mp = PyObject_GC_New(PyDictObject, &PyDict_Type);
        if (mp == NULL) {
            DK_DECREF(keys);
            free_values(values);
            return NULL;
        }
    }
    mp->ma_keys = keys;
    mp->ma_values = values;
    mp->ma_used = 0;
    mp->ma_version_tag = DICT_NEXT_VERSION();
    assert(_PyDict_CheckConsistency(mp));
    return (PyObject *)mp;
}

/* Consumes a reference to the keys object */
static PyObject *
new_dict_with_shared_keys(PyDictKeysObject *keys)
{
    PyObject **values;
    Py_ssize_t i, size;

    // 获得新 dict 的最小大小
    size = USABLE_FRACTION(DK_SIZE(keys));
    values = new_values(size);
    if (values == NULL) {
        DK_DECREF(keys);
        return PyErr_NoMemory();
    }
    for (i = 0; i < size; i++) {
        // 初始化指针为 NULL
        values[i] = NULL;
    }
    return new_dict(keys, values);
}
```

可以用 lookdict_split 函数从 split table 中查询值。它的逻辑大体和 lookdict_unicode_nodummy 相同，只是在读取值是从 ma_values 里面读取：
```c
if (ep->me_key == key ||
    (ep->me_hash == hash && unicode_eq(ep->me_key, key))) {
    *value_addr = mp->ma_values[ix];
    return ix;
}
```

除此之外，有一个帮助我们判断一个 dict 是否是 split table 的宏：
```c
#define _PyDict_HasSplitTable(d) ((d)->ma_values != NULL)
```
## 结束
先就这样吧

![girl](https://arian-blogs.oss-cn-beijing.aliyuncs.com/18-12-31/50518040.jpg)