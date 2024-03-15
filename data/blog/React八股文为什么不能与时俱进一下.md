---
title: React八股文为什么不能与时俱进一下
date: 2024/3/14 17:24:07
lastmod: 2024/3/8 17:24:07
tags: [React]
draft: false
summary: 背着背着一搜源码根本没有我背的这个函数谁懂我的崩溃🤬应该还有其他的但我啥时候发现啥时候再说吧
authors: ['default']
images: https://picsum.photos/800/500?random=6
layout: PostLayout
---

# 合成事件

：我们写的事件是绑定在`dom`上么，如果不是绑定在哪里？

吟唱：React 基于浏览器的事件机制自身实现了一套事件机制，包括事件注册、事件的合成、事件冒泡、事件派发等，在 React 中这套事件机制被称之为**合成事件**，合成事件会以**事件委托(event delegation)的方式绑定到 document 上，并且在组件卸载(unmount)的时候自动销毁绑定的事件**，通过**把原生的事件封装在一个 SyntheticEvent 实例中**，而不是直接把原生的浏览器事件传给处理器，SyntheticEvent 在表现和功能上都与浏览器的原生事件一致，而且**消除了跨浏览器的差异**。

停一下，真的是绑在 document 上吗

在 React 17 版本之前，所有用户事件都需要冒泡到 document 上,由 React 做统一分发与处理。

但这个做法是存在缺陷的，如果冒泡的过程中碰到 shadowRoot 节点，就会将事件拦截在 shadowRoot 范围内，此时 event.target 强制指向 shadowRoot，导致在 react 中事件无响应。

因此，React 17 之后事件监听位置**由 document 改为了挂载 App 组件的 root 节点**，就不存在此问题了。而且这样也是有利于微前端的，**微前端一个前端系统中可能有多个应用，如果继续采取全部绑定在`document`上，那么可能多应用下会出现问题。**

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7eb82d03f1f249828e20df78284358f0~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1512&h=1169&s=681813&e=png&b=ffffff)

# setState 究竟是异步还是同步

大部分八股文都是这么写的：

React 通过 `isBatchingUpdates`来判断 setState 是先存进 state 队列还是直接更新，如果值为 true 则执行异步操作，进入等待队列；为 false 则为同步操作，直接更新。

- **异步：** 在 React 可以控制的地方，就为 true，比如在 **React 生命周期事件和合成事件中**，都会走合并操作，延迟更新的策略。
- **同步：** 在 React 无法控制的地方，比如**原生**事件，具体就是在 **addEventListener 、setTimeout、setInterval** 等事件中，就只能同步更新。

**但是 React 也是会更新的这都 2024 了好吧**

- 在 React 18 之前，React 仅在浏览器事件处理期间才会做批量更新，在其他事件（比如：Promise、setTimeout、native 事件）期间是不会执行的。

- 在 React 18 版本中，并且使用 `ReactDOM.createRoot`，则 React 会在**所有事件**中进行**自动批量更新（Automatic Batching）** 。而如果使用`ReactDOM.render`，则会依旧维持之前版本的表现。

如果不想自动批处理，可以使用 `ReactDOM.flushSync`将 state 更新分开包裹

```js
import { flushSync } from 'react-dom' // Note: react-dom, not react

function handleClick() {
  flushSync(() => {
    setCounter((c) => c + 1)
  })
  flushSync(() => {
    setFlag((f) => !f)
  })
}

// 结果：点击一次 button，会打印两个"Render"
```

## 批处理的方式

先上结论

- 在 React17 之前，过 `isBatchingUpdates`来判断是否进行批处理
- 在 React17 之后，通过`executionContext`是否包含`batchContext`来判断

我们首先需要了解 react16 中是如何控制的， 他通过 `isBatchingUpdates`来判断 setState 是先存进 state 队列还是直接更新，如果值为 true 则执行异步操作，进入等待队列；为 false 则为同步操作，直接更新。流程就是下面这样

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d0635aaa221d465585a25c885a3ad56f~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=790&h=624&s=46538&e=png&a=1&b=01cc66)

`isBatchingUpdates` 默认是 false ，意味着“当前并未进行任何批量更新操作”。每当 React 调用 batchedUpdate 去执行更新动作时，会先把这个锁给“锁上”（置为 true），表明“现在正处于批量更新过程中”。当锁被“锁上”的时候，任何需要更新的组件都只能暂时进入 `dirtyComponents` 里排队等候下一次的批量更新，而不能随意“插队”。此处体现的“任务锁”的思想，是 React 面对大量状态仍然能够实现有序分批处理的基石。

同步异步的差异其实在于这个事件是原生事件还是合成事件。React 为了解决跨平台，兼容性问题，自己封装了一套事件机制，代理了原生的事件，像在 jsx 中常见的 onClick、onChange 等等都是合成事件。在合成事件中，`isBatchingUpdates`  这个变量，在 React 的生命周期函数以及合成事件执行前，已经被 React 改为 true，这时我们所做的 setState 操作自然不会立即生效。当函数执行完毕后，事务的 close 方法会再把 isBatchingUpdates 改为 false。更具体的过程可以看一下[React 源码解析：合成事件](https://github.com/yangdui/blog/issues/20)

setState 的异步并不是指内部由异步代码实现，它本身执⾏的过程及代码都是同步的，只是由于合成事件和钩⼦函数的调⽤顺序在更新之前，因此导致了在合成事件和钩⼦函数中没法立刻拿到更新后的值，所以形成了所谓的异步。原生事件不用走这么多弯弯绕绕，

**React17 又改了！**

这就是这篇文章的来源，有一天晚上我去拉了 react 的源码，输入了`isBatchingUpdate`

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ddd9db99867841ec974dc6ab8834342c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1920&h=1030&s=448509&e=png&b=1e1e1e)

？？？？？？感觉物理学不存在了

于是我切换了好几个分支，发现 16 的时候确实是通过这个变量来控制的，17 以后确实没这个了

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a271123f83534cf6904dfda3ceae7c01~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1920&h=1030&s=348990&e=png&b=1e1e1e)

我真的搜了很久的关于批量更新，全网 95%的答案都是`isBatchingUpdate`，终于终于在我的不懈努力下搜到了结果

**`executionContext`！**

知道这个单词就好搜多了，在`batchUpdates`函数中，他会将一个全局变量`executionContext`附加上`batchContext`这个 flag，执行完这个函数后，它又会将`batchContext`从之前的`excutionContext`中移除

react 内部会判断，如果这次全局变量`executionContext`中包含了`batchContext`，他就会认为这是一次批处理，批处理中触发的`this.setState`都会被合并成一次更新，并且异步执行

在 react17 中，`setState`执行前会设置`executionContext`。虽然在 `setTimeout`、事件监听器等函数里，并不会设置 `executionContext`，也就是`excutionContext == noContext`，因为他们不是合成事件，这时候 `setState` 会同步执行。但如果在外面包一层 `batchUpdates` 函数，手动设置下 `excutionContext` ，就可以切换成异步批量执行。

但此时还是分异步同步的哈，18 版本才出现的自动批处理

`v18`实现「自动批处理」的关键在于两点：

- 增加调度的流程
- 不以全局变量`executionContext`为批处理依据，而是以更新的「优先级」为依据

```js
TODO: 私密马赛优先级实在没看懂看懂了再把这段补上吧
```

结论就是从`react 18`开始, 使用了`createRoot`创建应用后, 所有的更新都会自动进行批处理(也就是异步合并)。使用`render`的应用会保持之前的行为。如果你想保持同步更新行为, 可以使用`ReactDOM.flushSync()`。所以, 在升级到`18`版本之后只有在你使用`ReactDOM.render`的时候(LegacyMode)才会保持之前的行为, 否则都会对你的更新进行合并处理, 也就是自动批处理。
