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
  isElementNode() {return "Element" == this.nodeType}
  isTextNode() {return "Text" == this.nodeType}
  //---------------------------------------------------
  hasChildren() {return !_.isEmpty(this.children)}
  //---------------------------------------------------
  emptyChildren() {
    this.children = []
  }
  //---------------------------------------------------
  getText() {
    let ss = []
    if(this.hasChildren()) {
      for(let child of this.children) {
        ss.push(child.getText())
      }
    }
    return ss.join("")
  }
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
  treeWalk(depth=0, iteratee=_.identity){
    if(this.hasChildren()){
      for(let child of this.children) {
        child.treeWalk(depth+1, iteratee)
      }
    }
  }
  //---------------------------------------------------
  toString() {
    let ss = []
    this.treeWalk(0, ({depth, name, value})=>{
      let prefix = depth>0
        ? "|-- "
        : ""
      let display = value.display
        ? `{${value.display}}`
        : ""
      let attrs = value.attrs && !_.isEmpty(value.attrs)
        ? JSON.stringify(value.attrs)
        : ""
      let text = _.isString(value) ? value : ""
      ss.push(`${_.repeat("|   ", depth-1)}${prefix}${name} ${display} ${attrs}${text}`)
    })
    return ss.join("\n")
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapTextNode extends CheapNode {
  //---------------------------------------------------
  constructor(text="", parentNode=null){
    super("Text", parentNode)
    this.text = text
  }
  //---------------------------------------------------
  getMarkdown() {
    return this.text
  }
  //---------------------------------------------------
  getText() {
    return this.text
  }
  //---------------------------------------------------
  appendChild(){
    throw "Text canot append child"
  }
  //---------------------------------------------------
  treeWalk(depth=0, iteratee=_.identity) {
    iteratee({
      depth,
      name  : "!TEXT",
      value : this.text
    })
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
  }
  //---------------------------------------------------
  getAttr(name) {
    return this.attrs[name]
  }
  //---------------------------------------------------
  setAttr(name, value=true) {
    if(_.isString(name)) {
      this.attrs[name] = value
    }
    // attr set
    else if(_.isPlainObject(name)) {
      _.assign(this.attrs, name)
    }
  }
  //---------------------------------------------------
  isAttr(name, value) {
    return this.attrs[name] == value
  }
  //---------------------------------------------------
  empty() {
    super.emptyChildren()
  }
  //---------------------------------------------------
  appendText(text) {
    new CheapTextNode(text, this)
  }
  //---------------------------------------------------
  setText(text) {
    this.empty()
    this.appendText(text)
  }
  //---------------------------------------------------
  isTag(tagName) {
    return this.tagName == tagName
  }
  //---------------------------------------------------
  getMarkdown() {
    let mds = []
    for(let nd of this.children){
      mds.push(nd.getMarkdown())
      if(nd.isElementNode() 
         && /^(block|table)$/.test(nd.display)) {
        mds.push("\n\n")
      }
    }
    // Remove the Endle "\n\n"
    if(mds.length>0 && _.last(mds) == "\n\n") {
      mds = _.slice(mds, 0, mds.length-1)
    }
    return mds.join("")
  }
  //---------------------------------------------------
  setInnerMarkdown(markdown) {
    this.empty()
    this.appendMarkdown(markdown)
  }
  //---------------------------------------------------
  treeWalk(depth=0, iteratee=_.identity) {
    iteratee({
      depth,
      name  : this.tagName,
      value : {
        display: this.display,
        attrs  : this.attrs,
        style  : this.style
      }
    })
    super.treeWalk(depth, iteratee)
  }
  //---------------------------------------------------
  appendMarkdown(markdown) {
    //......................................
    // Define the regex
    let reg = '(\\*([^*]+)\\*)'
        + '|(\\*\\*([^*]+)\\*\\*)'
        + '|(__([^_]+)__)'
        + '|(~~([^~]+)~~)'
        + '|(`([^`]+)`)'
        + '|(!\\[([^\\]]*)\\]\\(([^\\)]+)\\))'
        + '|(\\[([^\\]]*)\\]\\(([^\\)]+)\\))'
        + '|(\\[([^\\]]*)\\]\\[([^\\]]+)\\])'
        + '|(https?:\\/\\/[^ ]+)';
    let REG = new RegExp(reg, "g");
    //......................................
    // Prepare matching
    let m;
    let pos = 0;
    //......................................
    // In loop
    while (m = REG.exec(markdown)) {
      //console.log(m)
      //....................................
      // !Head-Text
      if (pos < m.index) {
        var text = markdown.substring(pos, m.index);
        new CheapTextNode(text, this)
      }
      // EM: *xxx*
      if (m[1]) {
        new CheapEmphasisElement(this).setText(m[2])
      }
      // B: **xxx**
      else if (m[3]) {
        new CheapBoldElement(this).setText(m[4])
      }
      // U: __xxx__
      else if (m[5]) {
        new CheapUnderlineElement(this).setText(m[6])
      }
      // DEL: ~~xxx~~
      else if (m[7]) {
        new CheapDeletedTextElement(this).setText(m[8])
      }
      // CODE: `xxx`
      else if (m[9]) {
        let s2 = m[10]
        new CheapCodeElement(this).setText(s2)
      }
      // IMG or Video: ![](xxxx)
      else if(m[11]) {
        let alt = _.trim(m[12])
        let src = _.trim(m[13])
        let attrs = {src, alt}

        // Customized width/height
        // [100-50]
        let m2 = /^([0-9.]+(px|%|rem|em)?)-?([0-9.]+(px|%|rem|em)?)(:(.*))?$/.exec(alt);
        if(m2){
          attrs.width  = m2[1]
          attrs.height = m2[3]
          attrs.alt    = m2[6]
        }

        // For vidio
        if(/[.](mp4|avi|mov)$/.test(src)){
          new CheapVideoElement(this).setAttr(attrs)
        }
        // For Image
        else {
          new CheapImageElement(this).setAttr(attrs)
        }
      }
      // A: [](xxxx)
      else if (m[14]) {
        let href = m[16]
        let text = m[15]
        let attrs = {href}

        // New Tab
        if(text && text.startsWith("+")){
          attrs.target = "_blank"
          text = _.trim(text.substring(1))
        }

        // Gen tag
        let $an = new CheapAnchorElement(this)
        $an.setAttr(attrs)
        $an.appendText(text || href)
      }
      // A: [][refer]
      else if(m[17]) {
        let refer = m[19]
        let text = m[18]
        let attrs = {refer}

        // New Tab
        if(text && text.startsWith("+")){
          attrs.target = "_blank"
          text = _.trim(text.substring(1))
        }

        // Gen tag
        let $an = new CheapAnchorElement(this)
        $an.setAttr(attrs)
        $an.appendText(text || refer)
      }
      // A: http://xxxx
      else if(m[20]) {
        let href = m[20]
        let $an = new CheapAnchorElement(this)
        $an.setAttr({href, primaryLink:true})
        $an.appendText(href)
      }

      // The move the cursor
      pos = m.index + m[0].length
    } // ~ while (m = REG.exec(str)) {
    //......................................
    // !Tail-Text
    if(pos < markdown.length) {
      let text = markdown.substring(pos)
      new CheapTextNode(text, this)
    }

    //......................................
  } // ~appendMarkdown(markdown)
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapBoldElement extends CheapElement {
  constructor(parentNode=null) {
    super("B", "inline", {}, parentNode)
  }
}
class CheapItalicElement extends CheapElement {
  constructor(parentNode=null) {
    super("EM", "inline", {}, parentNode)
  }
}
class CheapEmphasisElement extends CheapElement {
  constructor(parentNode=null) {
    super("EM", "inline", {}, parentNode)
  }
}
class CheapUnderlineElement extends CheapElement {
  constructor(parentNode=null) {
    super("U", "inline", {}, parentNode)
  }
}
class CheapDeletedTextElement extends CheapElement {
  constructor(parentNode=null) {
    super("U", "inline", {}, parentNode)
  }
}
class CheapCodeElement extends CheapElement {
  constructor(parentNode=null) {
    super("CODE", "inline", {}, parentNode)
  }
}
class CheapAnchorElement extends CheapElement {
  constructor(parentNode=null) {
    super("A", "inline", {}, parentNode)
  }
}
class CheapImageElement extends CheapElement {
  constructor(parentNode=null) {
    super("IMG", "inline", {}, parentNode)
  }
}
class CheapVideoElement extends CheapElement {
  constructor(parentNode=null) {
    super("VIDEO", "inline", {}, parentNode)
  }
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
class CheapTableHeadElement extends CheapElement {
  constructor(parentNode=null){
    super("THEAD", "table-head", {}, parentNode)
  }
}
///////////////////////////////////////////////////////
class CheapTableBodyElement extends CheapElement {
  constructor(parentNode=null){
    super("TBODY", "table-body", {}, parentNode)
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
    // Split Cells
    let ss = _.without(markdown.split("|"), "")

    // Gen cells
    for(let s of ss) {
      let $cell = new CheapTableDataCellElement(this)
      $cell.appendMarkdown(s)
    }
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapTableDataCellElement extends CheapElement {
  constructor(parentNode=null){
    super("TD", "table-cell", {}, parentNode)
  }
}
///////////////////////////////////////////////////////
class CheapListElement extends CheapElement {
  constructor(tagName, parentNode=null){
    super(tagName, "block", {}, parentNode)
  }
}
///////////////////////////////////////////////////////
class CheapOrderedListElement extends CheapListElement {
  constructor(parentNode=null){
    super("OL", parentNode)
  }
}
///////////////////////////////////////////////////////
class CheapUnorderedListElement extends CheapListElement {
  constructor(parentNode=null){
    super("UL", parentNode)
  }
}
///////////////////////////////////////////////////////
class CheapListItemElement extends CheapElement {
  constructor(parentNode=null){
    super("LI", "block", {},  parentNode)
  }
}
///////////////////////////////////////////////////////
class CheapHrElement extends CheapElement {
  constructor(parentNode=null){
    super("HR", "block", {},  parentNode)
  }
}
///////////////////////////////////////////////////////
class CheapPreformattedTextElement extends CheapElement {
  //---------------------------------------------------
  constructor(parentNode=null){
    super("PRE", "block", {},  parentNode)
  }
  //---------------------------------------------------
  isGFMCode() {
    return this.isAttr("mode", "GFM")
  }
  //---------------------------------------------------
  getCodeType(dft=null) {
    return this.getAttr("type") || dft
  }
  //---------------------------------------------------
  addCodeLine(codeLine) {
    if(!_.isUndefined(codeLine) && !_.isNull(codeLine)) {
      new CheapTextNode(codeLine, this)
    }
  }
  //---------------------------------------------------
  getMarkdown() {
    let mds = []
    let prefix = this.isGFMCode() ? "" : "    ";
    if(this.isGFMCode()) {
      mds.push("```" + this.getCodeType(""))
    }
    for(let nd of this.children){
      mds.push(prefix + nd.getMarkdown())
    }
    if(this.isGFMCode()) {
      mds.push("```")
    }
    return mds.join("\n")
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapBlockQuoteElement extends CheapElement {
  //---------------------------------------------------
  constructor(parentNode=null){
    super("BLOCKQUOTE", "block", {},  parentNode)
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapSectionHeadingElement extends CheapElement {
  //---------------------------------------------------
  constructor(level=1, parentNode=null){
    super(`H${level}`, "block", {level},  parentNode)
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapParagraphElement extends CheapElement {
  //---------------------------------------------------
  constructor(parentNode=null){
    super("P", "block", {},  parentNode)
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapBodyElement extends CheapElement {
  //---------------------------------------------------
  constructor(parentNode=null){
    super("BODY", "block", {},  parentNode)
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapDocument {
  //---------------------------------------------------
  constructor(){
    this.$body = new CheapBodyElement()
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
    return this.$top ? false : true
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
  isTopAs(elementClass) {
    return this.$top && elementClass && (this.$top instanceof elementClass)
  }
  //---------------------------------------------------
  /***
   * @return {repush, closed}
   */
  pushLine(line="") {
    let trimed = _.trim(line)
    this.lineCount ++
    //.................................................
    let m;  // Matcher result
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
    // >>> Pre
    if(this.isTopAs(CheapPreformattedTextElement)) {
      // GFM code
      if(this.$top.isGFMCode()) {
        // Closed
        if("```" == trimed) {
          return {closed:true}
        }
        // Join Code
        else {
          this.$top.addCodeLine(line)
        }
      }
      // Indent code
      else {
        // Still indent code
        if(cI > 0) {
          let codeLine = line.substring(cI)
          this.$top.addCodeLine(codeLine)
        }
        // Quit indent
        else {
          return {repush:true, closed:true}
        }
      }
    }
    //.................................................
    // >>> List
    if(this.$li) {
      let liDepth = this.$li.getAttr("depth")
      let myDepth = parseInt(indent/this.listIndent)
      let $list;
      //-----------------------------------
      // Child
      if(myDepth > liDepth) {
        // Create  $list later
      }
      //-----------------------------------
      // Sibling
      else if(myDepth == liDepth) {
        $list = this.$li.parentNode
      }
      //-----------------------------------
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
      //-----------------------------------
      // eval current line
      let start = undefined;
      m = /^(([*-])|(\d)\.) +(.+)$/.exec(trimed)
      if(m) {
        if(!this.isEmpty()){
          return {closed:true, repush:true}
        }
        start = m[3] * 1
      }
      //-----------------------------------
      // Create new list if necessary
      if(!$list) {
        // <P>
        if(_.isUndefined(start)) {
          $list = new CheapParagraphElement(this.$li)
        }
        // <OL>
        else if(isNaN(start)) {
          $list = new CheapOrderedListElement(this.$li)
        }
        // <UL>
        else {
          $list = new CheapUnorderedListElement(this.$li)
        }
      }
      //-----------------------------------
      // <OL | UL> append children
      if($list instanceof CheapListElement) {
        this.$li = new CheapListItemElement($list)
        this.$li.setAttr({
          indent,
          depth : parseInt(indent % this.listIndent)
        })
        let text = _.trim(trimed.substring(2))
        this.$li.appendMarkdown(text)
      }
      //-----------------------------------
      // <P> append children
      else {
        $list.appendMarkdown(trimed)
      }
      //-----------------------------------
    }
    //+++++++++++++++++++++++++++++++++++++++++++++++++
    // empty block: return true to end the block
    //+++++++++++++++++++++++++++++++++++++++++++++++++
    if(!trimed) {
      return {closed: !this.isEmpty()}
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
      this.$top = new CheapSectionHeadingElement(n)
      this.$top.appendMarkdown(m[2])
      return {closed:true}
    }
    //.................................................
    // Indent Code
    if(cI > 0) {
      this.$top = new CheapPreformattedTextElement()
      this.$top.setAttr({mode: "GFM"})
      let codeLine = line.substring(cI)
      this.$top.addCodeLine(codeLine)
      return
    }
    //.................................................
    // GFM Code
    if(trimed.startsWith("```")) {
      let type = _.trim(trimed.substring(3)) || null
      this.$top = new CheapPreformattedTextElement()
      this.$top.setAttr({
        mode: "GFM", type
      })
      return
    }
    //.................................................
    // HR
    if(/^(-{3,}|={3,})$/.test(trimed)) {
      this.$top = new CheapHrElement()
      return {closed:true}
    }
    //.................................................
    // BLOCKQUOTE
    if(trimed.startsWith('>')) {
      if(!this.isEmpty() && !this.isTopTag("BLOCKQUOTE")){
        return {repush:true, closed:true}
      }
      this.$top = new CheapBlockQuoteElement()
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
      // Create top OL/UL
      let start = m[3] * 1
      // UL
      if(isNaN(start)) {
        this.$top = new CheapUnorderedListElement()
      }
      // OL 
      else {
        this.$top = new CheapOrderedListElement()
        this.$top.setAttr({start})
      }
      // Append the first list item
      this.$li = new CheapListItemElement(this.$top)
      this.$li.setAttr({
        indent,
        depth : parseInt(indent % this.listIndent)
      })
      // append list item content
      let text = _.trim(trimed.substring(2))
      this.$li.appendMarkdown(text)
    }
    //.................................................
    // TABLE
    if(/^([ |:-]{6,})$/.test(trimed) && 1==this.lineCount && !this.isEmpty()) {
      let header = this.$top.getMarkdown()
      this.$top = new CheapTableElement();
      let $thead = new CheapTableHeadElement(this.$top)
      let $h_row = new CheapTableRowElement($thead)
      $h_row.appendMarkdown(header)

      this.$tbody = new CheapTableBodyElement(this.$top)
    }
    //.................................................
    // Normal paragraph
    if(this.isEmpty()) {
      this.$top = new CheapParagraphElement()
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
    let line = lines[lnIndex++]
    let trimed = _.trim(line)
    // Ignore blank line
    if(!trimed) {
      continue
    }
    // Found the head part
    if('---' == trimed) {
      inHeader = true
    }
    // Always break
    break
  }
  //.................................................
  // Scan header
  while(inHeader && lnIndex < lines.length) {
    let line = lines[lnIndex++]
    let trimed = _.trim(line)
    // Ignore blank line
    if(!trimed) {
      continue
    }
    // Quit header
    if('---' == trimed) {
      inHeader = false
      break
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
    if(closed && !block.isEmpty()) {
      MdDoc.$body.appendChild(block.$top)
      block.reset()
    }
    // push again
    if(repush) {
      lnIndex --
    }
  }
  //.................................................
  return MdDoc
}
///////////////////////////////////////////////////////
export const Cheap = {
  parseMarkdown(markdown) {
    return CheapParseMarkdown(markdown)
  }
}
///////////////////////////////////////////////////////
// Install to window
if(window) {
  window.Cheap = Cheap
}
///////////////////////////////////////////////////////
