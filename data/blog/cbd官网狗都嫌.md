---
title: CBD可以是中央商务区，也可以是折磨了我一个月的官网
date: 2024/7/7 7:23:07
lastmod: 2024/7/7 19:39:47
tags: [实际应用]
draft: false
summary: 兄弟这辈子都没写过这么多scss
authors: ['default']
images: https://picsum.photos/800/500?random=7
layout: PostLayout
---

特别痛苦，是写完后我愿意和后台管理过一辈子的那种痛苦，设计稿大改两三次，技术方案写了白写，业务部门压排期，各种莫名其妙的兼容问题。。。。。。另外有人能理解为什么我们组要接这个活吗？？我是 m 端的啊？？？

就是他 ↓↓↓
![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fbd36e497b634c6492a40cf270b03f2d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1920&h=879&s=1981317&e=png&b=746960)

# 一些通用逻辑

## 语言

locale 参数主要是 bd 端希望匹配 c 端官网的语言，所以才需要传的
![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/381d9edc9e20418582edea2904ebfd64~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=542&h=703&s=22448&e=png&b=ffffff)

但是这样会有个小问题，因为 bd 端希望香港地区仅支持中文和英文，沙特地区仅支持英文和阿文，但是 c 端是支持三种语言的，因此如果你的 locale 参数传了 ar 并且不幸打开了香港地区的页面，就会出现虽然选择框只有中文和英文两个选项，但是由于前端的 i18n 初始化流程是可以拿到阿语翻译文件的，页面还是会显示成阿语，就完全乱套了。

因此 bd 端必须进行一些限制，如果出现了 options 以外的语言，重置为默认语言（**这里必须要刷新 url 里的 locale 参数，只是改缓存会被覆盖**）

## 区域

c 端本次迭代不区分区域，因此只有 bd 有这方面的需求，如果想要判断用户所处区域，最直接的方式是通过后端查 ip 库，但是后端说没有人力支持了 so 需要一些替代方案，由于是通过/hk，/sa 的方式来进行地区的区分的,因此在用户访问原域名时，会调用浏览器 api（下图所示，**必须经过用户授权**才能拿到经纬度），用户如果同意授权会触发`navigator.geolocation`的回调，然后去请求所在地区，如果是 sa，则跳转

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bd3719057bac4d60ba57dd6e2e40a939~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=420&h=211&s=16282&e=png&b=ffffff)

~~但我真的觉得这种方式很难评因为验收的时候我看没有一个人点了允许，甚至我觉得说哪怕拿时区去判断也比现在的这个方案好~~

后续如果需要迭代的话，其实还是查 ip 库会比较合适，将第一次查到的区域写进缓存，然后在选择切换地区的时候更新缓存，然后页面刷新，从缓存里拿（看了下竞对一般会搭配 cookie）

## 移动端适配

原有的 cbd 端正好是用了三种不同的方案，c 端复用部分组件，适配不了的使用两套组件；b 端是一套组件，但是写了两套样式，媒体查询判断是 mobile 还是 pc；d 端的话是两套组件两套样式。

b 端的自适应是通过`postcss-px-to-viewprot`实现的，自动将 px 转为 vw，对于 1px 问题，可以通过设置 minPixelValue 来解决，针对 1px 的单位不转化，默认就是 1px

## rtl

基于 roo 组件库的能力，搞了个 context 然后往里面传，可以实现部分反转~~但是效果稀巴烂必须一点点重新 rtl 样式~~

```css
[dir='rtl'] className{
    left变right（而且大概率left还得在搞成0）
    如果左右不想反转可以再用flex的row-reverse给他反过来
}
```

这里需要注意的就是，本质是利用 css 的元素权重来修改的，所以在写样式的时候一层父级元素也不能少。。。。不然只能`!important`

# C 好恐怖的一坨动画

谢邀，精神压力最大的一集，幸亏这个项目不是我一个人。。。。。。

## 视频自动播放

首页的展示逻辑是在视频文件加载前显示第一帧作为兜底图，加载完毕后自动播放视频，这里得用 js 判断是否需要替换资源和自动播放，并不能直接使用 autoplay 标签

## 页面加载优化

本质还是因为咱服务器离沙特确实有点远了哈，再加上页面动画和图片视频又比较多，沙特网又比较烂，最后的解决方案是图片和视频资源上传到 s3（也就是 cdn），js 使用 Uglify JS 进行丑化，最终是 fcp 是快了两秒，用过配置动态域名加速，效果不太不明显；嗯顺带一提其实想过用 webp 格式的图片，被否了捏

至于为什么不用图片懒加载，是因为有的时候图片还没加载完的时候动画会乱套，特别是手提袋动画，会直接出现半路消失又突然出现在底部这种情况。。。。。

~~另外我说真的业务部门有点欺负人了，你为啥要跟一个没有视频的页面比加载速度。。。。。人家那套资源加载下来才多大~~

## 整屏切换动画

一开始我想这还不容易啊，翻了好几个官网的元素一看 swiper 我直接了然！

哈哈。。。。但是人家那个是一直整屏滚。。。。我这个最后一页还得出现个滚动条呢。。。。。。。最后的解决方案是手撕动画，通过监听滚动事件并修改元素的`transform`属性来实现的整屏滚动的效果。

首先需要定义`currentPage`状态，用于保存当前的页面编号。 然后使用`useEffect`监听滚动事件，根据滚动的方向和距离，以及当前的页面编号`currentPage`，来决定是否需要滚动到下一个页面或上一个页面。 如果滚动的方向是向下（即差值 > 0），并且当前的页面编号小于 4（第五页是自由滚动），那么就将 currentPage 加 1，从而滚动到下一个页面。 如果滚动的方向是向上（即差值< 0），并且当前的页面编号大于 0（还没到顶），那么就将`currentPage`减 1，从而滚动到上一个页面。

页面的滚动是通过修改元素的 `transform` 属性来实现的，当`currentPage` 改变时，会更新元素的 `transform` 属性为 `translateY(${currentPage * -100}vh)`，这样就可以使元素沿 Y 轴移动到相应的位置，从而实现页面的滚动。

最大的问题在于最后一页的滚动，既然大家都是滚动事件，如何做出区分。这里选择定义了一个名为 `scrollDom`的 ref，并将其绑定到第五页的 DOM 元素上。这样，就可以通过 `scrollDom.current` 来访问这个 DOM 元素。 然后在 useEffect 中添加了一个滚动事件监听到 `scrollDom.current` 上，这个监听器的作用是检查第五页的顶部是否已经滚动出视口（即 top < 0），并将结果保存到 `isPageScroll.current` 中。这样，就可以通过 `isPageScroll.current` 来判断第五页是否正在滚动。

这里还有一个点是兼容问题，pc 端监听的是 wheel 事件，ipad 上没有 wheel，需要监听的是 touch 事件

## 轮播图切换

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/83540a0710c6499896248cfb8b872751~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1920&h=880&s=1223250&e=png&b=1a1a1a)

其实就是用 swiper 实现的啦，看起来比较高级是因为不是整屏翻动的，是通过改变左中右三个 div 的样式实现的，简单来说就是一旦翻页，就修改对应的类名，然后搞点 transform 动画啥的

## 自动播放动画

通过[getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)来监听元素是否进入视口实现，为啥不用[IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)是因为听说快速滚动会白屏~~额虽然我试了下也没白屏但我也不敢用，万一出事那就真完蛋了毕竟是官网~~

# B 全局样式 badcase

最痛苦的点在于之前的开发同学可能是觉得这个项目这辈子也不会有人维护了所以写了大量的全局样式哈哈哈哈哈哈哈哈哈哈。。。。。。导致改样式的时候一改就崩。。。。。。。一杯茶一包烟一个 selector 改一天啊。。。。。什么 not。。。。。什么 has。。。。。。滚出去。。。。。。。。

## region 改造

因为各个组件中需要拿到 region 来进行对应的图片和文案展示，为此搞了个 context 用来传入，region 参数封到了 useRegion 的 hook 里

```js
const RegionContext = createContext()

export const RegionProvider = ({ children }) => {
  const { regionCode } = useParams()
  const history = useHistory()
  const [region, setRegion] = useState(regionCode || 'hk') // 默认国家

  useEffect(() => {
    if (regionCode) {
      setRegion(regionCode)
    }
  }, [regionCode, history])

  return <RegionContext.Provider value={{ region, setRegion }}>{children}</RegionContext.Provider>
}

export const useRegion = () => useContext(RegionContext)
```

这样使用 RegionContext.Provider 包着根组件，各个组件就都能拿到 region 参数来进行对应的显示了，在区域选择组件中，调用 setRegion 方法来实现切换的功能。这里还有一个问题是，前端是通过 react 路由切换来实现的 region 切换，因此必须刷新一下页面，用来重置语言

# D 就给两天时间还没有 QA 不要命啦

纯体力活画静态页面，最大的问题是新项目的配置，新建打包上线配域名啥的，但是这方面并不是公开能说的内容。。。。。
因为是两套代码，就不太需要考虑 region 如何兼容的问题，直接 url 跳转就完事~

## faq 锚点跳转

faq 页面需要进行一个锚点跳转，这里是使用每个标题的 key 作为类名，router 传参发现有值就跳转到指定的位置实现的，这里需要**设置一个延时**，避免页面未加载完成的时候，跳转失败

## 旧域名重定向

出于各种原因当前的域名重定向是写在了代码里的，而不是用 301 实现，这里遇到了一个小坑，我尝试将 newHost 和 '/hk' 拼接后赋值给 newUrl.host。然而，URL 对象的 host 属性表示 URL 的主机部分，它包括主机名和（可选的）端口号。当路径（'/hk'）包含在 host 中时，这是不被允许的，如果要改变 URL 的 host 并添加一个路径，应该分别修改 host 和 pathname 属性

```js
const newUrl = new URL(currentUrl.toString())
newUrl.host = newHost
newUrl.pathname = '/hk'
window.location.replace(newUrl.toString())
```

## 序号效果

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ca1e1cf78b2648278bf7f4c1816af85f~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=709&h=284&s=30428&e=png&b=f7f7f7)

是通过伪元素实现的，不得不说我的 css 水平在这次折磨里突飞猛进。。。。。

```css
.list-item {
  position: relative;
  &::before {
    // 计数
    content: counter(item);
    counter-increment: item;
    position: absolute;
    left: 0;
    top: 0;
    font-size: 20px;
    background-color: #000;
    color: #fff;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }
}
```
