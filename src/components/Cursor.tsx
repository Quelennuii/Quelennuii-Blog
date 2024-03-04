import React, { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

// 轨迹线性插值
const lerp = (a: number, b: number, n: number) => (1 - n) * a + n * b

const getStyle = (el: HTMLElement, attr: string) => {
  try {
    return window.getComputedStyle
      ? window.getComputedStyle(el)[attr]
      : (el as any).currentStyle[attr]
  } catch (e) {}
  return ''
}

class Cursor {
  cursor: HTMLDivElement | null = null
  scr: HTMLStyleElement | null = null
  pos = { curr: null as any, prev: null as any }
  pt: string[] = []

  constructor() {
    this.create()
    this.init()
    this.render()
  }

  move(left: number, top: number) {
    if (this.cursor) {
      this.cursor.style['left'] = `${left}px`
      this.cursor.style['top'] = `${top}px`
    }
  }

  create() {
    if (!this.cursor) {
      this.cursor = document.createElement('div')
      this.cursor.id = 'cursor'
      this.cursor.classList.add('cursor-hidden')
      document.body.append(this.cursor)
    }

    var el = document.getElementsByTagName('*')
    for (let i = 0; i < el.length; i++)
      if (getStyle(el[i] as HTMLElement, 'cursor') === 'pointer') this.pt.push(el[i].outerHTML)

    document.body.appendChild((this.scr = document.createElement('style')))
    this.scr.innerHTML = `* {cursor: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' width='8px' height='8px'><circle cx='4' cy='4' r='4' fill='black' opacity='.5'/></svg>") 4 4, auto}`
  }
  refresh() {
    if (this.scr) this.scr.remove()
    if (this.cursor) {
      this.cursor.classList.remove('cursor-hover')
      this.cursor.classList.remove('cursor-active')
    }
    this.pos = { curr: null, prev: null }
    this.pt = []

    this.create()
    this.init()
    this.render()
  }

  init() {
    document.onmouseover = (e) => {
      if (
        (e.target as HTMLElement).outerHTML &&
        this.pt.includes((e.target as HTMLElement).outerHTML)
      ) {
        this.cursor?.classList.add('cursor-hover')
      }
    }
    document.onmouseout = (e) => {
      if (
        (e.target as HTMLElement).outerHTML &&
        this.pt.includes((e.target as HTMLElement).outerHTML)
      ) {
        this.cursor?.classList.remove('cursor-hover')
      }
    }

    document.onmousemove = (e) => {
      this.pos.curr == null && this.move(e.clientX - 8, e.clientY - 8)
      this.pos.curr = { x: e.clientX - 8, y: e.clientY - 8 }
      this.cursor?.classList.remove('cursor-hidden')
    }
    // 移出窗口时隐藏
    document.onmouseenter = (e) => this.cursor?.classList.remove('cursor-hidden')
    document.onmouseleave = (e) => this.cursor?.classList.add('cursor-hidden')
    document.onmousedown = (e) => this.cursor?.classList.add('cursor-active')
    document.onmouseup = (e) => this.cursor?.classList.remove('cursor-active')
  }

  render() {
    if (this.pos.prev) {
      this.pos.prev.x = lerp(this.pos.prev.x, this.pos.curr.x, 0.15)
      this.pos.prev.y = lerp(this.pos.prev.y, this.pos.curr.y, 0.15)
      this.move(this.pos.prev.x, this.pos.prev.y)
    } else {
      this.pos.prev = this.pos.curr
    }
    requestAnimationFrame(() => this.render())
  }
}
const CursorComponent: React.FC = () => {
  const cursorRef = useRef<Cursor | null>(null)
  const { theme } = useTheme()

  //主题变了鼠标也得变颜色
  useEffect(() => {
    const color = theme === 'light' ? 'black' : 'white'
    if (cursorRef.current) {
      //   fill='${color}'，必须写单引号
      cursorRef.current.scr.innerHTML = `* {cursor: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' width='8px' height='8px'><circle cx='4' cy='4' r='4' fill='${color}' opacity='.5'/></svg>") 4 4, auto}`
    }
  }, [theme])

  useEffect(() => {
    cursorRef.current = new Cursor()
    // 需要重新获取列表时，使用 cursorRef.current.refresh()
  }, [])

  return null
}

export default CursorComponent
