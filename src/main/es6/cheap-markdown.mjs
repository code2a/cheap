/******************************************************
 * Cheap Markdown Parser and Render
 * 
 * By zozoh @ 2020
 */
///////////////////////////////////////////////////////
class CheapNode {
  //---------------------------------------------------
  constructor(nodeType="Element", parentNode=null) {
    this.nodeType = nodeType
    if(parentNode) {
      parentNode.appendChild(this)
    }
  }
  //---------------------------------------------------
  __children() {
    if(!_.isArray(this.children)) {
      this.children = []
    }
    return this.children
  }
  //---------------------------------------------------
  hasChildren() {return !_.isEmpty(this.children)}
  //---------------------------------------------------
  childrenNodes() {
    return this.children
  }
  //---------------------------------------------------
  appendChild(node) {
    node.parentNode = this
    this.__children().push(node)
  }
  //---------------------------------------------------
  prependChild(node) {
    this.__children().unshift(node)
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapText extends CheapNode {
  //---------------------------------------------------
  constructor(text="", endLine=false, parentNode=null){
    super("Text", parentNode)t
    this.text = text
    this.endLine = endLine
  }
  //---------------------------------------------------
  appendChild(){
    throw "Text canot append child"
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapElement extends CheapNode {
  //---------------------------------------------------
  constructor(tagName="P", display="block", {
    style = {},   // bold, italic, underline
    attrs = {}
  }={}, parentNode=null) {
    super("Element", parentNode)
    this.tagName = _.toUpper(tagName)
    this.display = _.toLower(display)
    this.style = style || {}
    this.attrs = attrs || {}
    this.markdowns = []
  }
  //---------------------------------------------------
  getAttr(name) {
    return this.attrs[name]
  }
  //---------------------------------------------------
  empty() {
    this.markdowns = []
  }
  //---------------------------------------------------
  isTag(tagName) {
    return this.tagName == tagName
  }
  //---------------------------------------------------
  appendText(text, endLine=false) {
    new CheapText(text, endLine, this)
  }
  //---------------------------------------------------
  getMarkdown() {
    return this.markdowns.join("\n");
  }
  //---------------------------------------------------
  setInnerMarkdown(markdown) {
    this.empty()
    this.appendMarkdown(markdown)
  }
  //---------------------------------------------------
  appendMarkdown(markdown) {
    this.markdowns.push(markdown)
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapTableElement extends CheapElement {
  constructor(parentNode=null) {
    super("TABLE", "table", {}, parentNode)
  }
  appendMarkdown(markdown) {
    throw "TABLE can't appendMarkdown!!!"
  }
}
///////////////////////////////////////////////////////
class CheapTableRowElement extends CheapElement {
  //---------------------------------------------------
  constructor(parentNode=null) {
    super("TR", "table-row", {}, parentNode)
  }
  //---------------------------------------------------
  appendMarkdown(markdown) {
    this.markdowns = [markdown]

    // Split Cells
    //...
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapTableElement extends CheapElement {
  constructor(parentNode=null) {
    super("TABLE", "table", {}, parentNode)
  }
}
///////////////////////////////////////////////////////
class CheapDocument {
  //---------------------------------------------------
  constructor(){
    this.$root = new CheapElement(null, "markdown")
    this.$meta = {}
  }
  //---------------------------------------------------
  setMeta(name, value) {
    this.$meta[name] = value
  }
  //---------------------------------------------------
  pushMetaValue(name, value) {
    let val = this.$meta[name]
    if(!_.isArray(val)) {
      val = val ? [val] : []
      this.$meta[name] = val
    }
    val.push(value)
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapBlock {
  //---------------------------------------------------
  constructor({
    indentAsCode = 4,   // how many indent as code block
    tabIndent    = 4,     // TAB key indent value
    listIndent   = 2
  }={}){
    this.indentAsCode = indentAsCode
    this.tabIndent  = tabIndent
    this.listIndent = listIndent
    this.reset()
  }
  //---------------------------------------------------
  isEmpty() {
    return this.$top ? true : false
  }
  //---------------------------------------------------
  reset() {
    this.$top = null
    this.lineCount = 0
    this.$tbody = null
    this.$li = null
  }
  //---------------------------------------------------
  getTopAttr(name, dft=undefined) {
    return this.$top ? this.$top.getAttr(name) : dft
  }
  //---------------------------------------------------
  isTopTag(tagName) {
    return this.$top && this.$top.tagName == tagName
  }
  //---------------------------------------------------
  isTopAttr(name, val) {
    return this.getTopAttr(name) == val
  }
  //---------------------------------------------------
  /***
   * @return {repush, closed}
   */
  pushLine(line="") {
    let trimed = _.trim(line)
    this.lineCount ++
    //.................................................
    // Count indent
    let indent = 0
    let cI = -1
    for(let i=0; i<line.length; i++) {
      let c = line.charAt(i)
      // Remember the pos for indent-code
      if(cI < 0 && indent >= this.indentAsCode) {
        cI = i
      }
      // space indent
      if(' ' == c) {
        indent ++
      }
      // Tab indent
      else if('\t' == c) {
        indent += this.tabIndent
      }
      // Quit
      else {
        break
      }
    }
    //.................................................
    // >>> Code
    if(this.isTopTag("CODE")) {
      // Indent code
      if(this.isTopAttr("byIndent", true)) {
        // Still indent code
        if(cI > 0) {
          let codeLine = line.substring(cI)
          this.$top.appendText(codeLine, true)
        }
        // Quit indent
        else {
          return {repush:true, closed:true}
        }
      }
      // GFM code
      else {
        // Closed
        if("```" == trimed) {
          return {closed:true}
        }
        // Join Code
        else {
          this.$top.appendText(line, true)
        }
      }
    }
    //.................................................
    // >>> List
    if(this.$li) {
      let liDepth = this.$li.getAttr("depth")
      let myDepth = parseInt(indent/this.listIndent)
      let $list;
      // Child
      if(myDepth > liDepth) {
        // Create  $list later
      }
      // Sibling
      else if(myDepth == liDepth) {
        $list = this.$li.parentNode
      }
      // find parent
      else {
        $list = this.$li.parentNode
        let $li = $list.parentNode
        while($li && $li.isTag("LI") && $li.getAttr("depth")>=myDepth) {
          $list = $li.parentNode
          $li = $list.parentNode
        }
        // Repush
        if(!$li || !$li.isTag("LI")){
          return {closed:true, repush:true}
        }
      }

      // current line -> List Item 
      let tagName = "P"
      let attrs = {}
      m = /^(([*-])|(\d)\.) +(.+)$/.exec(trimed)
      if(m) {
        if(!this.isEmpty()){
          return {closed:true, repush:true}
        }
        let start = m[3] * 1
        tagName = isNaN(start) ? "UL" : "OL"
        attrs = isNaN(start) ? {} : {start}
      }

      // Create new list if necessary
      if(!$list) {
        $list = new CheapElement(tagName, "block", {attrs}, this.$li)
      }

      // Add current list item
      if("P" != tagName) {
        this.$li = new CheapElement("LI", "block", {
          attrs: {
            indent,
            depth : parseInt(indent % this.listIndent)
          }
        }, $list)
        let text = _.trim(trimed.substring(2))
        this.$li.appendMarkdown(text)
      }
      // current as normal paragraph
      else {
        $list.appendMarkdown(trimed)
      }
    }
    //.................................................
    // empty block: return true to end the block
    if(!trimed) {
      return {closed: this.isEmpty()}
    }
    //.................................................
    // >>> TABLE
    if(this.$tbody) {
      let $row = new CheapTableRowElement(this.$tbody)
      $row.appendMarkdown(trimed)
      return
    }
    //.................................................
    // Heading : H1~6
    m = /^(#{1,})[\t ]+(.*)$/.exec(trimed)
    if(m) {
      let n = m[1].length
      this.$top = new CheapElement(`H${n}`, "block")
      this.$top.appendMarkdown(m[2])
      return {closed:true}
    }
    //.................................................
    // Indent Code
    if(cI > 0) {
      this.$top = new CheapElement("CODE", "block", {
        attrs: {byIndent:true}
      })
      let codeLine = line.substring(cI)
      this.$top.appendText(codeLine, true)
      return
    }
    //.................................................
    // GFM Code
    if(trimed.startsWith("```")) {
      let type = _.trim(trimed.substring(3)) || null
      this.$top = new CheapElement("CODE", "block", {
        attrs: {type}
      })
      return
    }
    //.................................................
    // HR
    if(/^(-{3,}|={3,})$/.test(trimed)) {
      this.$top = new CheapElement("HR", "block")
      return {closed:true}
    }
    //.................................................
    // BLOCKQUOTE
    if(trimed.startsWith('>')) {
      if(!this.isEmpty() && !this.isTopTag("BLOCKQUOTE")){
        return {repush:true, closed:true}
      }
      this.$top = new CheapElement("BLOCKQUOTE", "block")
      let text = _.trim(trimed.substring(1))
      this.$top.appendMarkdown(text)
      return
    }
    //.................................................
    // UL / OL
    m = /^(([*-])|(\d)\.) +(.+)$/.exec(trimed)
    if(m) {
      if(!this.isEmpty()){
        return {closed:true, repush:true}
      }
      let start = m[3] * 1
      let tagName = isNaN(start) ? "UL" : "OL"
      let attrs = isNaN(start) ? {} : {start}
      this.$top = new CheapElement(tagName, "block", {attrs})
      this.$li = new CheapElement("LI", "block", {
        attrs: {
          indent,
          depth : parseInt(indent % this.listIndent)
        }
      }, this.$top)
      let text = _.trim(trimed.substring(2))
      this.$li.appendMarkdown(text)
    }
    //.................................................
    // TABLE
    if(/^([ |:-]{6,})$/.test(trimed) && 1==this.lineCount && !this.isEmpty()) {
      let header = this.$top.getMarkdown()
      this.$top = new CheapTableElement();
      let $thead = new CheapElement("THEAD", "table-head", {}, this.$top)
      let $h_row = new CheapTableRowElement($thead)
      $h_row.appendMarkdown(header)

      this.$tbody = new CheapElement("TBODY", "table-body", {}, this.$top)
    }
    //.................................................
    // Normal paragraph
    if(this.isEmpty()) {
      this.$top = new CheapElement("P", "block")
    }
    this.$top.appendMarkdown(line)
    //.................................................
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
function CheapParseMarkdown(markdown="") {
  //.................................................
  // Prapare
  let lines   = markdown.split(/\r?\n/)
  let block = new CheapBlock()
  let lastMetaKey = null
  let lnIndex = 0
  //.................................................
  let MdDoc = new CheapDocument()
  //.................................................
  // Find the header
  let inHeader = false
  while(lnIndex < lines.length) {
    let line = lines[lnIndex]
    let trimed = _.trim(line)
    // Ignore blank line
    if(!trimed) {
      lnIndex ++
      continue
    }
    // Found the head part
    if('---' == trimed) {
      lnIndex ++
      inHeader = true
    }
  }
  //.................................................
  // Scan header
  while(inHeader && lnIndex < lines.length) {
    let line = lines[lnIndex]
    let trimed = _.trim(line)
    // Ignore blank line
    if(!trimed) {
      lnIndex ++
      continue
    }
    // Quit header
    if('---' == trimed) {
      lnIndex ++
      inHeader = false
    }
    // Join List
    if(trimed.startsWith("-")) {
      if(lastMetaKey) {
        let v = _.trim(trimed.substring(1))
        MdDoc.pushMetaValue(lastMetaKey, v)
      }
    }
    // Set meta value
    else {
      let [k, v] = trimed.split(":")
      MdDoc.setMeta(k, v)
      lastMetaKey = k
    }
  }
  //.................................................
  // Scan document body
  for(; lnIndex < lines.length; lnIndex++) {
    let line = lines[lnIndex]
    let {repush, closed} = block.pushLine(line) || {}
    // Closed block
    if(closed) {
      MdDoc.$root.appendChild(block.$top)
      block.reset()
    }
    // push again
    if(repush) {
      lnIndex --
    }
  }
  //.................................................
}
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
export const Cheap = {
  parse(markdown) {
    console.log("cheap", markdown)
  }
}
///////////////////////////////////////////////////////
// Install to window
if(window) {
  window.Cheap = Cheap
}
///////////////////////////////////////////////////////
