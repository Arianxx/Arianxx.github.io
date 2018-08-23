---
title: 在python中延迟执行函数
date: 2018-06-27 07:10:21
tags:
    - python
categories: python
---
js有一个常用的函数叫做setTimeout，可以延迟函数的执行而又不阻塞当前上下文。这是一个奇特的行为，因为js本身运行在单线程中。因此，在某些时候，可以发现，js上下文中的函数会影响setTimeout排定函数的运行。例如，如果此时有一个while true的函数阻塞，传递给setTimeout的函数也永远不会执行。

在python中，也可以实现类似js 中setTimeout的行为。主要发现了以下几种方法：
<!--MORE-->

## 使用time.sleep函数
可以使用time.sleep沉睡一段时间，然后再调用函数。但这样同时也会阻塞当前上下文。可以考虑使用多线程封装time.sleep函数，让函数在多线程中执行，从而达到不阻塞上下文，又延迟执行的目的。

## 使用threading.Timer函数
threading.Timer函数可以指定一个延迟时间，传入的函数会在新线程指定的时间后运行。

给人的感觉就像是上面封装了time.sleep一样。可以这样用：
```python
def SetTimeout(func, time, *args, **kwargs):
    task = Timer(time, func, args=args, kwargs=kwargs)
    task.start()
    return task
```


## 根据延迟时间轮询任务
可能在多数情况下，我们的需求不只是让一个函数在给定的时间后延迟执行，并且还想同时排定多个任务，让它们按照给定的优先级（时间），依次执行。这种情况下，可以使用`优先队列`，不断轮询时间以查看是否有可以执行的任务。

想要阻塞当前上下文，让所有任务执行完毕后才开始继续执行接下来的任务，可以就在本线程轮询；想要不阻塞，就可以放在多线程中轮询，并且，因为多线程共享资源，所以还可以在轮询开始后继续添加新任务。

可以这样实现：
```python
import time
import heapq
from datetime import datetime, timedelta
from threading import Thread

class TimeEvent:
    def __init__(self, func, plan_time, *args, **kwargs):
        self.func = func
        self.plan_time = plan_time
        self.args = args
        self.kwargs = kwargs
        self.result = None

    def __lt__(self, other):
        # For heap sort.
        return self.plan_time < other.plan_time

    def execute(self):
        self.alive = True
        self.result = self.func(*self.args, **self.kwargs)
        self.alive = False
        self.over = True

        return self.result


class TimeEventLoop:
    def __init__(self):
        self.events = []
        self.alive = False
        self.end = False
        self.thread = None

    def add_event(self, func, time, *args, absolute=False, **kwargs):
        if not absolute:
            plan_time = datetime.now() + timedelta(0, time)
        else:
            plan_time = time
        event = TimeEvent(func, plan_time, *args, **kwargs)
        heapq.heappush(self.events, event)
        return event

    def _loop(self):
        event = heapq.heappop(self.evnets) if self.events else False
        while event and event.plan_time < datetime.now():
            event.execute()
            try:
                event = heapq.heappop(self.events)
            except IndexError:
                return
        if event:
            heapq.heappush(self.events, event)

    def _take_loop(self, timeout):
        self.alive = True
        start_time = time.time()
        while not self.end:
            self._loop()
            if timeout is not None \
                    and time.time() - start_time > timeout:
                break
            time.sleep(0.001)
        self.end = False
        self.alive = False

    def start_loop(self, timeout=None, in_thread=True):
        if in_thread:
            self.thread = Thread(target=self._take_loop, args=[timeout])
            self.thread.start()
            return self.thread
        else:
            self._take_loop(timeout)

```

它和js 的setTimeout类似，如果前面有函数耽搁了时间，那后面的函数的执行时间也会被推迟。但是，能够保证在给定时间之前的所有函数都会被运行。

## 使用异步
使用python中的异步，也就是协程，也可以完成我们的需求。嗯……然而目前对这方面并不太熟悉\_(:з)∠)_

或许可以这样实现：
```python
import asyncio


def hello(n):
    print('call {}'.format(n))


async def main(loop, callbacks):
    for callback in callbacks:
        loop.call_later(0.2, callback, 1)
        loop.call_later(0.1, callback, 2)
        loop.call_soon(callback, 3)
    await asyncio.sleep(1)


def loop():
    event_loop = asyncio.get_event_loop()
    event_loop.run_until_complete(main(event_loop, [hello]))
    event_loop.close()
```

会输出：
```python
call 3
call 2
call 1
```

## 使用信号
使用Signal信号模块，也可以完成类似行为。然而比协程更不熟悉……

看了相关内容后再来补充一波吧w

## 结语
先就这样吧，也欢迎提供其它想法~

## 参考
[stackoverflow 上的相关回答](https://stackoverflow.com/questions/10154568/postpone-code-for-later-execution-in-python-like-settimeout-in-javascript)