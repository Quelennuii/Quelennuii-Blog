---
title: 关于Fiber架构
date: 2024/2/18 18:34:29
lastmod: 2024/2/18 18:34:29
tags: [React]
draft: false
summary: 沉淀两年搞了两棵树，一棵叫Fiber树，另一棵也叫Fiber树
authors: ['default']
images: https://picsum.photos/800/500?random=1
layout: PostLayout
---

# React 架构的优化

## React15 架构的缺点

React15 架构可以分为两层：

- Reconciler（协调器）—— 负责找出变化的组件
- Renderer（渲染器）—— 负责将变化的组件渲染到页面上

在**Reconciler**中，`mount`的组件会调用[mountComponent](https://github.com/facebook/react/blob/15-stable/src/renderers/dom/shared/ReactDOMComponent.js#L498)，`update`的组件会调用[updateComponent](https://github.com/facebook/react/blob/15-stable/src/renderers/dom/shared/ReactDOMComponent.js#L877)。这两个方法都会**递归**更新子组件。

由于递归执行，所以更新一旦开始，中途就无法中断。当层级很深时，递归更新时间超过了 16ms，用户交互就会卡顿。听起来似乎很好解决，为什么不使用**可中断的异步更新**代替**同步的更新**来替代同步更新呢？因为 React15 的架构并**不支持异步更新**，即使你试图打断执行，`React15`也不会听你的。。。。。

基于这个原因，`React`决定重写整个架构。

## React16 架构

React16 后的架构可以分为三层：

- Scheduler（调度器）—— 调度任务的优先级，高优任务优先进入**Reconciler**
- Reconciler（协调器）—— 负责找出变化的组件
- Renderer（渲染器）—— 负责将变化的组件渲染到页面上

可以看到，相较于 React15，React16 中新增了**Scheduler（调度器）**，也就是实现优先级调度的核心

### Scheduler（调度器）

既然我们以浏览器是否有剩余时间作为任务中断的标准，那么我们需要一种机制，当浏览器有剩余时间时通知我们。

其实部分浏览器已经实现了这个 API，这就是[requestIdleCallback](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestIdleCallback)。但是由于以下因素，`React`放弃使用：

- 浏览器兼容性
- 触发频率不稳定，受很多因素影响。比如当我们的浏览器切换 tab 后，之前 tab 注册的`requestIdleCallback`触发的频率会变得很低

基于以上原因，`React`实现了功能更完备的`requestIdleCallback`polyfill，这就是**Scheduler**。除了在空闲时触发回调的功能外，**Scheduler**还提供了多种调度优先级供任务设置。

React16 架构优化的核心就在于 Scheduler 实现的**时间切片和优先级调度**，以及**Fiber 的链表结构**

### 时间切片原理

`时间切片`的本质是模拟实现[requestIdleCallback](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestIdleCallback)。

除去“浏览器重排/重绘”，下图是浏览器一帧中可以用于执行`JS`的时机。

```
-- 一个task(宏任务)
-- 队列中全部job(微任务)
-- requestAnimationFrame
-- 浏览器重排/重绘
-- requestIdleCallback
```

`requestIdleCallback`是在“浏览器重排/重绘”后如果当前帧还有空余时间时被调用的。

浏览器并没有提供其他`API`能够在同样的时机（浏览器重排/重绘后）调用以模拟其实现。

唯一能精准控制调用时机的`API`是`requestAnimationFrame`，他能让我们在“浏览器重排/重绘”之前执行`JS`。

这也是为什么我们通常用这个`API`实现`JS`动画 —— 这是浏览器渲染前的最后时机，所以动画能快速被渲染。所以，退而求其次，**`Scheduler`的`时间切片`功能是通过`task`（宏任务）实现的。**

最常见的`task`当属`setTimeout`了。但是有个`task`比`setTimeout`执行时机更靠前，那就是[MessageChannel](https://developer.mozilla.org/zh-CN/docs/Web/API/MessageChannel)。

所以`Scheduler`将需要被执行的回调函数作为`MessageChannel`的回调执行。如果当前宿主环境不支持`MessageChannel`，则使用`setTimeout`。

在`React`的`render`阶段，开启`Concurrent Mode`时，每次遍历前，都会通过`Scheduler`提供的`shouldYield`方法判断是否需要中断遍历，使浏览器有时间渲染：

```js
function workLoopConcurrent() {
  // Perform work until Scheduler asks us to yield
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress)
  }
}
```

**是否中断的依据，最重要的一点便是每个任务的剩余时间是否用完。**

在`Schdeduler`中，为任务分配的初始剩余时间为`5ms`。随着应用运行，会通过`fps`动态调整分配给任务的可执行时间。

这也解释了为什么[设计理念](https://react.iamkasong.com/preparation/idea.html#cpu%E7%9A%84%E7%93%B6%E9%A2%88)一节启用`Concurrent Mode`后每个任务的执行时间大体都是多于 5ms 的一小段时间 —— 每个时间切片被设定为 5ms，任务本身再执行一小段时间，所以整体时间是多于 5ms 的时间

### 优先级调度

首先我们来了解`优先级`的来源。需要明确的一点是，`Scheduler`是独立于`React`的包，所以他的`优先级`也是独立于`React`的`优先级`的。

`Scheduler`对外暴露了一个方法[unstable_runWithPriority](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/scheduler/src/Scheduler.js#L217-L237)。

这个方法接受一个`优先级`与一个`回调函数`，在`回调函数`内部调用获取`优先级`的方法都会取得第一个参数对应的`优先级`：

```js
function unstable_runWithPriority(priorityLevel, eventHandler) {
  switch (priorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
    case LowPriority:
    case IdlePriority:
      break
    default:
      priorityLevel = NormalPriority
  }

  var previousPriorityLevel = currentPriorityLevel
  currentPriorityLevel = priorityLevel

  try {
    return eventHandler()
  } finally {
    currentPriorityLevel = previousPriorityLevel
  }
}
```

可以看到，`Scheduler`内部存在 5 种优先级。

在`React`内部凡是涉及到`优先级`调度的地方，都会使用`unstable_runWithPriority`。

比如，我们知道`commit`阶段是同步执行的。可以看到，`commit`阶段的起点`commitRoot`方法的优先级为`ImmediateSchedulerPriority`。

`ImmediateSchedulerPriority`即`ImmediatePriority`的别名，为最高优先级，会立即执行。

```
function commitRoot(root) {
  const renderPriorityLevel = getCurrentPriorityLevel();
  runWithPriority(
    ImmediateSchedulerPriority,
    commitRootImpl.bind(null, root, renderPriorityLevel),
  );
  return null;
}
```

### 优先级的意义

`Scheduler`对外暴露最重要的方法便是[unstable_scheduleCallback](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/scheduler/src/Scheduler.js#L279-L359)。该方法用于以某个`优先级`注册回调函数。

比如在`React`中，之前讲过在`commit`阶段的`beforeMutation`阶段会调度`useEffect`的回调：

```js
if (!rootDoesHavePassiveEffects) {
  rootDoesHavePassiveEffects = true
  scheduleCallback(NormalSchedulerPriority, () => {
    flushPassiveEffects()
    return null
  })
}
```

这里的回调便是通过`scheduleCallback`调度的，优先级为`NormalSchedulerPriority`，即`NormalPriority`。

不同`优先级`意味着什么？不同`优先级`意味着不同时长的任务过期时间：

```js
var timeout
switch (priorityLevel) {
  case ImmediatePriority:
    timeout = IMMEDIATE_PRIORITY_TIMEOUT
    break
  case UserBlockingPriority:
    timeout = USER_BLOCKING_PRIORITY_TIMEOUT
    break
  case IdlePriority:
    timeout = IDLE_PRIORITY_TIMEOUT
    break
  case LowPriority:
    timeout = LOW_PRIORITY_TIMEOUT
    break
  case NormalPriority:
  default:
    timeout = NORMAL_PRIORITY_TIMEOUT
    break
}

var expirationTime = startTime + timeout
```

其中：

```js
// Times out immediately
var IMMEDIATE_PRIORITY_TIMEOUT = -1
// Eventually times out
var USER_BLOCKING_PRIORITY_TIMEOUT = 250
var NORMAL_PRIORITY_TIMEOUT = 5000
var LOW_PRIORITY_TIMEOUT = 10000
// Never times out
var IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt
```

可以看到，如果一个任务的`优先级`是`ImmediatePriority`，对应`IMMEDIATE_PRIORITY_TIMEOUT`为`-1`，那么

```
var expirationTime = startTime - 1;
```

则该任务的过期时间比当前时间还短，表示他已经过期了，需要立即被执行。

### 不同优先级任务的排序

我们已经知道`优先级`意味着任务的过期时间。设想一个大型`React`项目，在某一刻，存在很多不同`优先级`的`任务`，对应不同的过期时间。

同时，又因为任务可以被延迟，所以我们可以将这些任务按是否被延迟分为：

- 已就绪任务
- 未就绪任务

```js
if (typeof options === 'object' && options !== null) {
  var delay = options.delay
  if (typeof delay === 'number' && delay > 0) {
    // 任务被延迟
    startTime = currentTime + delay
  } else {
    startTime = currentTime
  }
} else {
  startTime = currentTime
}
```

所以，`Scheduler`存在两个队列：

- timerQueue：保存未就绪任务
- taskQueue：保存已就绪任务

每当有新的未就绪的任务被注册，我们将其插入`timerQueue`并根据开始时间重新排列`timerQueue`中任务的顺序。

当`timerQueue`中有任务就绪，即`startTime <= currentTime`，我们将其取出并加入`taskQueue`。

取出`taskQueue`中最早过期的任务并执行他。

为了能在 O(1)复杂度找到两个队列中时间最早的那个任务，`Scheduler`使用[小顶堆](https://www.cnblogs.com/lanhaicode/p/10546257.html)实现了`优先级队列`。

### Reconciler（协调器）

我们知道，在 React15 中**Reconciler**是递归处理虚拟 DOM 的。让我们看看[React16 的 Reconciler](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberWorkLoop.new.js#L1673)。

我们可以看见，更新工作从递归变成了可以中断的循环过程。每次循环都会调用`shouldYield`判断当前是否有剩余时间。

```js
/** @noinline */
function workLoopConcurrent() {
  // Perform work until Scheduler asks us to yield
  while (workInProgress !== null && !shouldYield()) {
    workInProgress = performUnitOfWork(workInProgress)
  }
}
```

那么 React16 是如何解决中断更新时 DOM 渲染不完全的问题呢？

在 React16 中，**Reconciler**与**Renderer**不再是交替工作。当**Scheduler**将任务交给**Reconciler**后，**Reconciler**会为变化的虚拟 DOM 打上代表增/删/更新的标记，类似这样：

```
export const Placement = /*             */ 0b0000000000010;
export const Update = /*                */ 0b0000000000100;
export const PlacementAndUpdate = /*    */ 0b0000000000110;
export const Deletion = /*              */ 0b0000000001000;
```

整个**Scheduler**与**Reconciler**的工作都在内存中进行。只有当所有组件都完成**Reconciler**的工作，才会统一交给**Renderer**。

### Renderer（渲染器）

**Renderer**根据**Reconciler**为虚拟 DOM 打的标记，同步执行对应的 DOM 操作。
假设我们点击按钮后，实现了一个数据的自增，他在 React16 架构中整个更新流程就会是如下情况

![更新流程](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/67dec00611664555b55bc42a4823e912~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2290&h=986&s=103015&e=png&b=ffffff)

其中红框中的步骤随时可能由于以下原因被中断：

- 有其他更高优任务需要先更新
- 当前帧没有剩余时间

由于红框中的工作都在内存中进行，不会更新页面上的 DOM，所以即使反复中断，用户也不会看见更新不完全的 DOM（即上一节演示的情况）。

# Fiber 的含义

在`React15`及以前， `StackReconciler` 方案由于**递归不可中断**问题，如果 Diff 时间过长（JS 计算时间），会造成页面 UI 的无响应（比如输入框）的表现，`vdom` 无法应用到 `dom` 中。

为了解决这个问题，React16 实现了新的基于 `requestIdleCallback` 的调度器。由于`React16`将**递归的无法中断的更新**重构为**异步的可中断更新**，此时曾经用于递归的**虚拟 DOM**数据结构已经无法满足需要。于是，全新的`Fiber`架构应运而生。

为了适配这种新的调度器，推出了 `FiberReconciler`，将原来的树形结构（vdom）转换成 Fiber 链表的形式（child/sibling/return），**整个 Fiber 的遍历是基于循环而非递归，可以随时中断**。更加核心的是，基于 Fiber 的链表结构，对于后续（React 17 lane 架构）的异步渲染和 （可能存在的）worker 计算都有非常好的应用基础

`Fiber`包含三层含义：

1.  作为架构来说，之前`React15`的`Reconciler`采用递归的方式执行，数据保存在递归调用栈中，所以被称为`stack Reconciler`。`React16`的`Reconciler`基于`Fiber节点`实现，被称为`Fiber Reconciler`。

        多个Fiber节点靠如下三个属性连接成树

        ````
        // 指向父级Fiber节点
        this.return = null;
        // 指向子Fiber节点
        this.child = null;
        // 指向右边第一个兄弟Fiber节点
        this.sibling = null;
        ````

        也就是说如果我们的组件是如下结构

        ````js
        function App() {
          return (
            <div>
              i am
              <span>KaSong</span>
            </div>
          )
        }
        ````

        他的Fiber树就会是如下结构

    ![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ad4218310ce04f2a9c333237fc593da0~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1618&h=1338&s=317289&e=png&b=ffffff)

> 为什么父级指针叫做`return`而不是`parent`或者`father`呢？因为作为一个工作单元，`return`指节点执行完`completeWork`后会返回的下一个节点。子`Fiber节点`及其兄弟节点完成工作后会返回其父级节点，所以用`return`指代父级节点。这就是可以打断执行的关键

3. 作为静态的数据结构来说，每个`Fiber节点`对应一个`React element`，保存了该组件的类型（函数组件/类组件/原生组件...）、对应的 DOM 节点等信息。
4. 作为动态的工作单元来说，每个`Fiber节点`保存了本次更新中该组件改变的状态、要执行的工作（需要被删除/被插入页面中/被更新...）。

   如下两个字段会保存调度优先级相关的信息

   ```js
   // 调度优先级相关
   this.lanes = NoLanes
   this.childLanes = NoLanes
   ```

# Fiber 的双缓存结构

`Fiber节点`构成的`Fiber树`就对应`DOM树`。如果想要更新`DOM`，就需要用到被称为“双缓存”的技术。双缓存是指**在内存中构建并直接替换**。在 React`Fiber树`的构建与替换——对应着`DOM树`的创建与更新。

在`React`中最多会同时存在两棵`Fiber树`。当前屏幕上显示内容对应的`Fiber树`称为`current Fiber树`，正在内存中构建的`Fiber树`称为`workInProgress Fiber树`。

`current Fiber树`中的`Fiber节点`被称为`current fiber`，`workInProgress Fiber树`中的`Fiber节点`被称为`workInProgress fiber`，他们通过`alternate`属性连接。

`React`应用的根节点通过使`current`指针在不同`Fiber树`的`rootFiber`间切换来完成`current Fiber`树指向的切换。

即当`workInProgress Fiber树`构建完成交给`Renderer`渲染在页面上后，应用根节点的`current`指针指向`workInProgress Fiber树`，此时`workInProgress Fiber树`就变为`current Fiber树`。

每次状态更新都会产生新的`workInProgress Fiber树`，通过`current`与`workInProgress`的替换，完成`DOM`更新。

关于 Fiber 树如何创建与替换，如果文字版不好理解也可以看一下这个视频 [卡老师的硬核 React 面试题](https://www.bilibili.com/video/BV16t4y1r7oJ/?spm_id_from=333.999.0.0&vd_source=83bd3864b056291a0ead94a5a56f7bef)

**render 以及 commit 阶段完整流程**

1. 首先会调用 ReactDOM.render，进入 render 阶段，
1. 采用深度优先遍历创建 fiber 树（current Fiber）（根节点一路向下找，没有子了找同级的兄弟，然后找上一级的兄弟，每次找到对应的节点就会调用创建阶段的生命周期函数），
1. 进入 commit 阶段，渲染完成后从根部开始执行 componentDidMount 函数，依次向上

**（假设此时用户产生了一次交互，每次调用 this.setState 都会创建完整的 fiber 树）**

1. 调用 this.setState，相应节点数据发生改变
1. 进入 render 阶段
1. 采取深度优先遍历重新创建一个 fiber 树（workInProgress Fiber），不更新的节点不调用对应的生命周期函数，如果 reconcile 算法发现这个节点数据变了，他会标记这次变化，调用这个节点对应的生命周期函数 get DerivedStatefromProps，render。
1. render 阶段完成后会进入 commit 阶段，执行这个节点变化的视图操作
1. 完成后，新创建的 fiber 树会替换之前的 fiber 树，等待下一次调用 this.setState 再生成一颗新的 fiber 树

## mount 时

```
function App() {
  const [num, add] = useState(0);
  return <p onClick={() => add(num + 1)}>{num}</p>;
}

ReactDOM.render(<App />, document.getElementById("root"));
```

1. 首次执行`ReactDOM.render`会创建`fiberRootNode`（源码中叫`fiberRoot`）和`rootFiber`。其中`fiberRootNode`是整个应用的根节点，`rootFiber`是`<App/>`所在组件树的根节点。

   之所以要区分`fiberRootNode`与`rootFiber`，是因为在应用中我们可以多次调用`ReactDOM.render`渲染不同的组件树，他们会拥有不同的`rootFiber`。但是整个应用的根节点只有一个，那就是`fiberRootNode`。

   `fiberRootNode`的`current`会指向当前页面上已渲染内容对应`Fiber树`，即`current Fiber树`。

   ![rootFiber](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0a228c9d698246669c00250e356e1373~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=659&h=380&s=6244&e=png&b=ffffff)

   ```
   fiberRootNode.current = rootFiber;
   ```

   由于是首屏渲染，页面中还没有挂载任何`DOM`，所以`fiberRootNode.current`指向的`rootFiber`没有任何`子Fiber节点`（即`current Fiber树`为空）。

2. 接下来进入`render阶段`，根据组件返回的`JSX`在内存中依次创建`Fiber节点`并连接在一起构建`Fiber树`，被称为`workInProgress Fiber树`。（下图中右侧为内存中构建的树，左侧为页面显示的树）

   在构建`workInProgress Fiber树`时会尝试复用`current Fiber树`中已有的`Fiber节点`内的属性，在`首屏渲染`时只有`rootFiber`存在对应的`current fiber`（即`rootFiber.alternate`）。

   ![workInProgressFiber](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/50781b34f14b47f7a2684870df3005bc~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=706&h=879&s=11730&e=png&b=ffffff)

3. 图中右侧已构建完的`workInProgress Fiber树`在`commit阶段`渲染到页面。

   此时`DOM`更新为右侧树对应的样子。`fiberRootNode`的`current`指针指向`workInProgress Fiber树`使其变为`current Fiber 树`。

   ![workInProgressFiberFinish](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2c7705a4d33949bebdd0cbb2d6b644b1~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=646&h=890&s=10044&e=png&b=ffffff)

## update 时

1. 接下来我们点击`p节点`触发状态改变，这会开启一次新的`render阶段`并构建一棵新的`workInProgress Fiber 树`。

   ![wipTreeUpdate](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d924f33a3d5b49e4994abff98c6503ba~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=716&h=890&s=15098&e=png&b=ffffff)

   和`mount`时一样，`workInProgress fiber`的创建可以复用`current Fiber树`对应的节点数据。

   > 这个决定是否复用的过程就是 Diff 算法

2. `workInProgress Fiber 树`在`render阶段`完成构建后进入`commit阶段`渲染到页面上。渲染完毕后，`workInProgress Fiber 树`变为`current Fiber 树`。

   ![currentTreeUpdate](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1d44575458314da6ba41da79b863d527~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=674&h=898&s=9956&e=png&b=ffffff)

# 如何实现任务中断和恢复

首先先了解一下为什么不使用 generateer

1. **Generator 不能在栈中间让出。**

   比如你想在**嵌套的函数**调用中间让出, 首先**你需要将这些函数都包装成 Generator**，另外这种栈中间的让出处理起来也比较麻烦，难以理解。

   除了语法开销，现有的生成器实现开销比较大，所以不如不用。

2. **Generator 是有状态的**, 很难在中间恢复这些状态。

React Fiber 实现任务中断和恢复的核心思想是**基于协作式的工作调度**（Cooperative Scheduling）。

React Fiber 实现任务中断和恢复的关键步骤包括：

1. **任务分割**： React Fiber 将渲染任务划分为多个小的工作单元，每个工作单元对应于组件树中的一个节点或一部分节点。这样就可以在执行每个工作单元时，检查当前任务的优先级，并在必要时中断任务。
1. **可中断的检查点**： 在每个工作单元之间插入了可中断的检查点（Checkpoint），这样在执行工作单元时，就可以根据优先级和时间片来中断任务。这些检查点允许 React 在任意时间中断当前任务，并在稍后恢复执行。
1. **优先级调度**： React Fiber 使用优先级调度算法（Lane）来确定每个工作单元的执行优先级。通过调整优先级，React 可以确保在页面加 载和用户交互时，优先处理最重要的任务，提高页面的响应速度和用户体验。
1. **时间片调度**： React Fiber 还引入了时间片（Time Slice）的概念，用于限制每个工作单元的执行时间。通过将工作拆分成小的时间片，**React 可以在每个时间片结束时中断任务，并在下一个时间片恢复执行**，从而确保页面渲染的连续性和流畅性。

## 哪个阶段可以打断执行

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e69fcd8dd2fc48609bb353f57f53b6c8~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=822&h=645&s=271622&e=png&b=fcfcfc)

之前是一边 Diff 一边提交的，现在分为两个阶段，reconciliation/render 协调阶段 和 commit 提交阶段 。

**（1）协调阶段，可以打断的**

- constructor
- componentWillMount 废弃
- componentWillReceiveProps 废弃
- static getDerivedStateFromProps
- shouldComponentUpdate
- componentWillUpdate 废弃
- render

因为 Reconciliation 阶段能被打断，会出现函数多次调用的情况，所以这些生命周期函数应该避免使用，16 版之后标记为不安全的

**（2）提交阶段，不能暂停，一直到界面更新完成**

- getSnapshotBeforeUpdate 严格来说，这个是在进入 commit 阶段前调用

- componentDidMount（发请求）

- componentDidUpdate

- componentWillUnmount

这也就是为什么 React 请求完全不推荐放在 componentWillMount 的原因，对于 componentWillMount 这个生命周期函数的调用次数会变得不确定，**React 可能会多次频繁调用 componentWillMount**，一个请求重复发送多次，这显然不是我们想要的结果

# Lane -React17 后推出的优先级机制

React 17 中推出了 Concurrent 模式，他是一组 React 的新功能，可帮助应用保持响应，并根据用户的设备性能和网速进行适当的调整。

现在，React 中有三套优先级机制：

1. React 事件优先级
1. Lane 优先级
1. Scheduler 优先级

17 之前，`React`可以控制`更新`在`Fiber`架构中运行/中断/继续运行。当一次`更新`在运行过程中被中断，过段时间再继续运行，这就是“异步可中断的更新”。

当一次`更新`在运行过程中被中断，转而重新开始一次新的`更新`，我们可以说：后一次`更新`打断了前一次`更新`。

这就是`优先级`的概念：后一次`更新`的`优先级`更高，他打断了正在进行的前一次`更新`。

但是，多个`优先级`之间如何互相打断？`优先级`能否升降？本次`更新`应该赋予什么`优先级`？
先前，如果「高优先级 IO 任务」阻塞了「低优先级 CPU 任务」，那么可能会出现即使你后台数据哐哐更新，但页面数据已经不发生改变的情况。

这就需要一个模型控制不同`优先级`之间的关系与行为，于是`lane`模型诞生了。

`lane`模型使用 31 位的二进制表示 31 条赛道，位数越小的赛道`优先级`越高，某些相邻的赛道拥有相同`优先级`。

既然`lane`对应了二进制的位，那么`优先级`相关计算其实就是位运算。

比如：

计算`a`、`b`两个`lane`是否存在交集，只需要判断`a`与`b`按位与的结果是否为`0`：

```js
export function includesSomeLane(a: Lanes | Lane, b: Lanes | Lane) {
  return (a & b) !== NoLanes
}
```

计算`b`这个`lanes`是否是`a`对应的`lanes`的子集，只需要判断`a`与`b`按位与的结果是否为`b`：

```js
export function isSubsetOfLanes(set: Lanes, subset: Lanes | Lane) {
  return (set & subset) === subset
}
```

将两个`lane`或`lanes`的位合并只需要执行按位或操作：

```js
export function mergeLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a | b
}
```

从`set`对应`lanes`中移除`subset`对应`lane`（或`lanes`），只需要对`subset`的`lane`（或`lanes`）执行按位非，结果再对`set`执行按位与。

```js
export function removeLanes(set: Lanes, subset: Lanes | Lane): Lanes {
  return set & ~subset
}
```
