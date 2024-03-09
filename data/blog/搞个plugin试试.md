---
title: 搞个Plugin试试
date: 2024/3/8 17:24:07
lastmod: 2024/3/8 17:24:07
tags: [Webpack]
draft: false
summary: 教练我也想学webpack
authors: ['default']
images: https://picsum.photos/800/500?random=5
layout: PostLayout
---

想法来源于一道面试题，关于多页面的重复内容（如 footer 和 header）如何避免重复代码，毕竟当多个页面都拥有相同的 HTML 结构时，如果每个页面都添加一模一样的代码，多多少少都会对性能有一些影响，后期的维护成本也会提高。翻了一下解决方案，发现可以将这些共用的 HTML 抽取出来形成类似组件的形式，在页面中直接引入就可以。正好在学 webpack 打算搞个 plugin 实践一下。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/eece9ebe8f4e4b889460dc73065bc2a3~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1814&h=851&s=347204&e=png&b=ffffff)

实现思路是和实习的时候做的国际化插件差不多，就是写个没用的东西先占位。当时那个 bug 是注释中本该不受影响的的中文被替换成了 i18n 的 key 形式，解决方案是提前将全部注释依次推入一个数组，逐一替换成/-comment-index-/的形式，再进行中文替换，后续在写入文件前，依次替换回注释内容，这也是插件中扫描中文的实现逻辑，感觉是一种很通用的思路 🧐 套到这里，就是搞个 plugin，将头部和底部单独提出来，在`webpack`打包的时候将其注入到要打包完成的`html`页面中

# 环境配置

首先初始化一个项目，安装 webpack

```js
pnpm init
pnpm add -D webpack webpack-cli cross-env

```

此时会得到这样一个目录结构

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4144b5f0b3954b85a03e731f333d486e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=415&h=439&s=23639&e=png&b=181818)

从来没见过这么干净的 package.json🤣

```js
{
  "name": "webpack-learning",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "cross-env": "^7.0.3",
    "webpack": "^5.90.3",
    "webpack-cli": "^5.1.4"
  }
}
```

添加 build 脚本，build 指令如果你啥也不写直接 webpack，默认会调用`node_modules/.bin`下的`webpack`命令，内部会调用`webpack-cli`解析用户参数进行打包，默认会以`src/index.js`作为入口文件。

```js
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "build": "webpack"
  },
```

这个时候如果在终端输入 pnpm run build 就会执行对应脚本，现在可以新建 src 目录，定义 index.js 入口文件，编写一个测试函数试一下可不可以正常打包

测试函数是 1+1，此时 dist 文件夹出现了如下内容，说明环境是 ok 的

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/33a504e1662f4232a262cf949c64a436~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1920&h=1030&s=128614&e=png&b=1d1d1d)

# webpack.config.js

首先需要解决一下环境问题，毕竟我也没见过哪个项目光秃秃只有`"build" : "webpack"`

```js
"scripts": {
        "build": "cross-env NODE_ENV=production webpack --config webpack.config.js"
    },
```

这个命令做了以下几件事情：

1. 使用  `cross-env`  设置环境变量  `NODE_ENV`  为  `production`。`cross-env`  是一个 npm 包，它的作用是在不同的操作系统（Windows、Linux、MacOS 等）上以一种统一的方式设置环境变量。在这里，它设置  `NODE_ENV`  环境变量为  `production`，这通常意味着我们正在构建用于生产环境的代码，所以 webpack 会进行一些优化，比如压缩和混淆代码。
1. 运行  `webpack`  命令。`webpack`  是一个模块打包工具，它会根据你的配置（在这里是  `webpack.config.js`文件）来打包你的 JavaScript 代码。在这里，`--config webpack.config.js`  指定了 webpack 的配置文件为  `webpack.config.js`

现在我们可以新建，然后进行配置了

```js
// webpack.config.js
const path = require('path')
module.exports = {
  // process是node.js中的一个全局变量，它返回当前进程的相关信息
  // process.env包含着关于系统环境的信息
  // NODE_ENV是用户自定义的一个变量，在webpack中它的作用是用来判断生产环境或开发环境
  mode: process.env.NODE_ENV,
  // 入口文件
  entry: './src/index.js',
  // 输出
  output: {
    // 文件名
    filename: 'index.js',
    // 路径，__dirname是node.js中的一个全局变量，它指向当前执行脚本所在的目录
    path: path.resolve(__dirname, 'dist'),
  },
}
```

现在我们可以新建一个 HTML 文件……等一下似乎少了一步

webpack 原生只支持打包 JS 文件，要支持打包其他类型的文件，都需要安装相应的插件或 loader，所以我们需要安装一下[`html-webpack-plugin`插件](https://webpack.docschina.org/plugins/html-webpack-plugin/)

执行`pnpm add -D html-webpack-plugin`，并修改`webpack.config.js`配置

```js
// webpack.config.js
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
module.exports = {
  // process是node.js中的一个全局变量，它返回当前进程的相关信息
  // process.env包含着关于系统环境的信息
  // NODE_ENV是用户自定义的一个变量，在webpack中它的作用是用来判断生产环境或开发环境
  mode: process.env.NODE_ENV,
  // 入口文件
  entry: './src/index.js',
  // 输出
  output: {
    // 文件名
    filename: 'index.js',
    // 路径，__dirname是node.js中的一个全局变量，它指向当前执行脚本所在的目录
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Webpack Template',
      // 输出文件名，根路径是module.exports.output.path
      filename: 'index.html',
      // 模板文件
      template: path.resolve('./public/index.html'),
      // 是否添加hash，默认为false，这个hash是和文件内容相关的，只要文件内容不变，hash就不变
      hash: true,
      // 压缩
      minify: {
        // 是否删除注释
        collapseWhitespace: true,
        // 是否删除空格
        removeAttributeQuotes: true,
        // 是否删除属性的引号
        minifyCSS: true,
        // 是否压缩html里的css（使用clean-css进行的压缩）
        minifyJS: true,
      },
      // inject: true | 'head' | 'body' | false
      // true：默认值，script标签位于html文件的 body 底部
      // head：script标签位于 head 标签内
      // body：script标签位于 body 标签内
      // false：不插入生成的 js 文件，只是单纯的生成一个 html 文件
      inject: 'body',
      // 加载js的方式，`blocking`、`defer`
      // `blocking`：当浏览器遇到script标签时，会停止解析html，直到加载完script标签里的js文件
      // `defer`：当浏览器遇到script标签时，会继续解析html，直到解析完html再加载js文件
      scriptLoading: 'blocking',
    }),
  ],
}
```

# 编写 plugin

现在我们要编写一个插件去解决这个替换问题，首先我们需要一个占位的废话（？），也就是在`html`中写一个类似于`<!-- replace:"head" -->`的注释，之后在`webpack`打包时，对于`html`文件进行正则匹配，将能匹配到的内容通通替换成我们想要的效果（footer 或 header）。

在 webpack 中，插件的本质是函数，他是由一个构造函数实例化出来的。这个构造函数会定义一个`apply`方法，当我们使用插件的时候，`apply`方法会被`webpack compiler`调用一次。`apply`方法可以接收一个`webpack compiler`对象的引用，从而可以在回调函数中访问到`compiler`对象。`Plugin`大概长这样

```js
class myPlugin {
  // 在构造函数中获取用户给该插件传入的配置
  // `options`是插件的配置选项
  constructor(options) {
    this.options = options || {}
  }

  // Webpack 会调用插件的apply方法给插件实例传入compiler对象
  apply(compiler) {
    // 通过compiler对象可以注册一些钩子函数
    compiler.hooks.someHook.tap('myPlugin', (params) => {
      // 在这里可以使用webpack提供的api来操作文件,比如读取、写入文件等
    })
  }
}

// 导出 Plugin
module.exports = myPlugin
```

最常用的两个对象就是`compiler`和`compilation`

- `compiler`对象代表了完整的 webpack 环境配置，包含`options`、`loaders`、`plugins`这些信息，这个对象在`webpack`启动时候被实例化，它是全局唯一的，可以简单地把它理解为`webpack`实例。这个对象在启动 webpack 时被一次性创建，并且配置在整个编译生命周期中都不会改变。你可以在  `compiler`  对象上注册一些在编译生命周期内持续监听的事件。
- `compilation`对象代表了一次单独的编译过程。这个对象包含了当前的模块资源、编译生成资源、变化的文件等，当`webpack`以开发模式运行时，每当检测到一个文件变化，一次新的`compilation`将被创建，`compilation`  对象也提供了很多事件回调供插件做自定义处理，通过`compilation`也能读取到`compiler`对象。

`compiler`和`compilation`的区别在于`: compiler`代表了整个`webpack`从启动到关闭的生命周期，而`compilation`只是代表了一次新的编译。

`webpack`就像一条生产线，要经过一系列处理流程后才能将源文件转换成输出结果，这条生产线上的每个处理流程的职责都是单一的，多个流程之间有存在依赖关系，只有完成当前处理后才能交给下一个流程去处理，插件就像是一个插入到生产线中的一个功能，在特定的时机对生产线上的资源做处理，`webpack`通过`tapable`来组织这条复杂的生产线。

以下是一些常用的  `compiler`  钩子：

- `entryOption`: 在 webpack 选项中的 entry 配置项被处理过后触发。
- `afterPlugins`: 在设置完初始插件后触发。
- `compile`: 在一个新的编译创建之前触发。
- `make`: 编译阶段，可以用来添加自定义的模块。
- `emit`: 在生成资源到 output 目录之前触发。
- `afterEmit`: 在生成资源到 output 目录之后触发。
- `done`: 编译完成后触发。

由于我们是需要修改打包文件中的内容，所以需要赶在他生成（输出`asset`到`output`目录）之前截胡，也就是要在`emit`时期处理资源文件，此时要需要注意`emit`是一个异步的`hook`，所以我们需要使用`Tapable`的`tapAsync`或者`tapPromise`，如果选取的是同步的`hook`，则可以使用`tap`。

> 1. `tap`: 用于注册同步钩子。当钩子被触发时，注册的函数会立即执行。
>
> ```js
> compiler.hooks.someHook.tap('myPlugin', (params) => {
>   // 同步执行的代码
> })
> ```
>
> 2. `tapAsync`: 用于注册异步串行钩子。注册的函数会接收一个额外的  `callback`  参数，当异步操作完成后，需要调用这个  `callback`  函数来通知 webpack 继续执行。
>
> ```js
> compiler.hooks.someHook.tapAsync('myPlugin', (params, callback) => {
>   // 异步执行的代码
>   // 完成后调用 callback
>   callback()
> })
> ```
>
> 3. `tapPromise`: 用于注册异步并行钩子。注册的函数需要返回一个 Promise 对象，当 Promise 完成（resolve）或失败（reject）时，webpack 会继续执行。
>
> ```js
> compiler.hooks.someHook.tapPromise('myPlugin', (params) => {
>   // 返回一个 Promise
>   return new Promise((resolve, reject) => {
>     // 异步执行的代码
>     // 完成后调用 resolve 或 reject
>   })
> })
> ```

现在，我们终于可以新建一个`InjectTemplate.js`文件，来编写插件了！

首先在入口文件写上要替换的注释，正则匹配的时候通过 replace 传入的不同判断是 header 还是 footer

```js
  <body>
    <!-- replace="header" -->
    <div id="app"></div>
    <!-- replace="footer" -->
  </body>
```

然后再修改`webpack.config.js`配置，导入我们编写的插件，这里的 url 是用来下载远程模版文件的，如果不需要也可以不传参

```js
    ...
    plugins:[
        ...
        new InjectTemplate({
            url: "http://localhost:8080/index.html",
        })
    ]

```

插件整体的实现思路就是注释占位 ➡ 匹配 html 文件 ➡ 匹配占位注释 ➡ 替换注释 ➡ 写入文件，比较麻烦的就是各种 api 的含义

```js
// chrome://inspect, 在 "Remote Target" 部分
// 点击 "inspect" 链接来打开一个新的调试窗口。

// 用来模拟异步请求数据
const RemoteData = (key) => {
  const data = {
    header: '<div>THIS IS HEADER</div>',
    footer: '<div>THIS IS FOOTER</div>',
  }
  return Promise.resolve(data[key])
}

class InjectTemplate {
  // 用来接收配置参数
  constructor(options) {
    this.options = options || {}
  }
  // apply是一个插件必须的方法，它会在webpack启动时自动调用
  apply(compiler) {
    // thisCompilation 是一个异步钩子，当编译创建新的compilation实例时触发
    // tapn 方法的第一个参数是插件名称，第二个参数是回调函数
    compiler.hooks.thisCompilation.tap('InjectTemplate', (compilation) => {
      // processAssets 是一个异步钩子，当生成资源到 output 目录时触发
      // tapPromise 方法的第一个参数是插件名称，第二个参数是回调函数
      compilation.hooks.processAssets.tapPromise(
        {
          name: 'InjectTemplate',
          // 在资源添加到输出目录之前执行
          stage: compilation.constructor.PROCESS_ASSETS_STAGE_ADDITIONS,
          // additionalAssets 为 true 时，表示插件会生成额外的资源
          additionalAssets: true,
        },
        // assets 是一个对象，包含了所有即将输出的资源
        // 调用replaceAssets方法，修改资源
        (assets) => this.replaceAssets(assets, compilation)
      )
    })
  }

  // 用来修改资源
  replaceAssets(assets, compilation) {
    return new Promise((resolve) => {
      //如果不想使用远程数据，可以使用cache来存储数据，直接读取
      const cache = {}
      // 获取资源的key，即资源的路径
      const assetKeys = Object.keys(assets)
      for (const key of assetKeys) {
        // replaceAssets方法需要在所有的资源都处理完毕后标记为完成
        // 所以需要判断是否是最后一个资源
        const isLastAsset = key === assetKeys[assetKeys.length - 1]
        // 如果不是html文件，直接跳过
        if (!/.*\.html$/.test(key)) {
          // 如果是最后一个资源，调用resolve方法
          if (isLastAsset) {
            resolve()
          }
          continue
        }
        // 获取当前资源的内容
        let target = assets[key].source()
        // 匹配资源中的注释是否包含replace属性，即是否需要替换
        // matchAll 生成所有与正则表达式匹配的字符串
        const matchedValues = target.matchAll(/<!-- replace="(\S*?)" -->/g)
        const tags = []
        for (const item of matchedValues) {
          // item[0]是匹配到的字符串，item[1]是匹配到的分组
          const [tag, name] = item
          tags.push({
            tag,
            name,
            // 默认使用cache中的数据，如果没有，使用远程数据
            data: cache[name] ? cache[name] : RemoteData(name),
          })
        }
        // 等待异步请求数据完成
        Promise.all(tags.map((item) => item.data))
          .then((res) => {
            res.forEach((data, index) => {
              const tag = tags[index].tag
              const name = tags[index].name
              if (!cache[name]) cache[name] = data
              // 替换匹配到的字符串
              target = target.replace(tag, data)
            })
          })
          .then(() => {
            // 将修改后的资源添加到compilation.assets中
            compilation.assets[key] = {
              // 返回资源的内容
              source() {
                return target
              },
              // 返回资源的大小
              size() {
                return this.source().length
              },
            }
          })
          .then(() => {
            // 如果是最后一个资源，调用resolve方法
            if (isLastAsset) resolve()
          })
      }
    })
  }
}

module.exports = InjectTemplate
```

现在，让我们再次执行`pnpm run build`，看看能不能成功

```js
//.dist/index.html
<!DOCTYPE html><html lang=en><head><meta charset=utf-8><meta http-equiv=X-UA-Compatible content="IE=edge"><meta name=viewport content="width=device-width,initial-scale=1"><title></title></head><body><div>THIS IS HEADER</div><div id=app></div><div>THIS IS FOOTER</div><script src=index.js?fbe89716555582f62c56></script></body></html>
```

可以看到注释部分已经显示了我们需要的 footer 和 header！
