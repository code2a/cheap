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
      if(parentNode instanceof CheapNode) {
        parentNode.appendChild(this)
      }
      // Append Document
      else if(parentNode instanceof CheapDocument){
        this.$document = parentNode
      }
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
  document() {
    if(!this.$document) {
      if(this.parentNode) {
        this.$document = this.parentNode.document()
      }
    }
    return this.$document
  }
  //---------------------------------------------------
  body() {
    return this.document().getBodyElement()
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
    node.$document = this.$document
    this.__children().push(node)
  }
  //---------------------------------------------------
  prependChild(node) {
    node.parentNode = this
    node.$document = this.$document
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
        ? `<${value.display}>`
        : ""
      let attrs = value.attrs && !_.isEmpty(value.attrs)
        ? JSON.stringify(value.attrs)
        : ""
      let text = _.isString(value) ? `"${_.trim(value)}"` : ""
      ss.push(`${_.repeat("|   ", depth-1)}${prefix}${name}${display}${attrs}${text}`)
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
    closeBy = "EndTag", // Self | EndTag
    style = {},   // bold, italic, underline
    attrs = {}
  }={}, parentNode=null) {
    super("Element", parentNode)
    this.tagName = _.toUpper(tagName)
    this.display = _.toLower(display)
    this.style   = style || {}
    this.attrs   = attrs || {}
    this.closed  = closed
  }
  //---------------------------------------------------
  canSelfClose() {return "Self" == this.closeBy}
  //---------------------------------------------------
  hasAttrs(){
    return !_.isEmpty(this.attrs)
  }
  //---------------------------------------------------
  getAttr(name, dft) {
    let val = this.attrs[name]
    return _.isUndefined(val)
      ? dft
      : val
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
  getRuntimeAttrs() {
    return this.attrs || {}
  }
  //---------------------------------------------------
  getRuntimeAttr(name, dft) {
    let val = this.getRuntimeAttrs()[name]
    return _.isUndefined(val)
      ? dft
      : val
  }
  //---------------------------------------------------
  isAttr(name, value) {
    return this.attrs[name] == value
  }
  //---------------------------------------------------
  hasStyle(){
    return !_.isEmpty(this.style)
  }
  //---------------------------------------------------
  isDisplayAs(regex=/^inline/){
    return regex.test(this.display)
  }
  //---------------------------------------------------
  isDisplayAsInline(){
    return this.isDisplayAs(/^inline/)
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
    if(_.isRegExp(tagName)) {
      return tagName.test(this.tagName)
    }
    return this.tagName == tagName
  }
  //---------------------------------------------------
  getMarkdown() {
    let mds = []
    for(let nd of this.children){
      mds.push(nd.getMarkdown())
      if(nd.isElementNode() 
         && !nd.isDisplayAsInline()) {
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
  getOutterHtml(options, depth=0) {
    //console.log("getOutterHtml", this.tagName, depth, options)
    // prefix for indent space
    let prefix = options.indent > 0 && depth>0
          ? _.repeat(" ", options.indent*depth)
          : "";
    // prepare str-buffer to render tag
    let ss = []

    // Block
    if(!this.isDisplayAsInline()){
      ss.push("\n", prefix)
    }

    // TagName
    let tagName = _.toLower(this.tagName)
    ss.push("<", tagName)
    // Attributes
    _.forEach(this.getRuntimeAttrs(options), (v, k)=>{
      ss.push(` ${k}="${v}"`)
    })

    // Styles
    if(this.hasStyle()){
      ss.push(' style="')
      _.forEach(this.style, (v, k)=>{
        ss.push(`${k}:${v};`)
      })
      ss.push('"')
    }

    // Inner HTML
    let html = this.getInnerHtml(options, depth+1);

    // Closed if empty
    if(!html) {
      // Self close
      if(this.canSelfClose()) {
        ss.push("/>")
      }
      // Require close tag
      else {
        ss.push("></", tagName, ">")
      }
    }
    // Join children
    else {
      ss.push(">")
      if(this.isDisplayAsInline()) {
        ss.push(html)  
      }
      // Block element
      else {
        ss.push(html)
      }
      // Close tag
      ss.push("</", tagName, ">")
    }
    // done
    return ss.join("")
  }
  //---------------------------------------------------
  getInnerHtml(options, depth=0) {
    // prepare to html render list
    let html = []
    if(this.hasChildren()){
      for(let nd of this.children){
        // Text Node
        if(nd.isTextNode()) {
          html.push(nd.getText())
        }
        // Element node
        else if(nd.isElementNode()){
          let ndHtml = nd.getOutterHtml(options, depth)
          html.push(ndHtml)
        }
      }
    }
    return html.join("")
  }
  //---------------------------------------------------
  appendMarkdown(markdown) {
    //console.log("--", markdown)
    //......................................
    // Define the regex
    let reg = '(\\*([^*]+)\\*)'
        + '|(\\*\\*([^*]+)\\*\\*)'
        + '|((?<=(\\s|^))_{1,2}(\\S+)_{1,2}(?=(\\s|$)))'
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
      // B/EM: __xxx__ or _xxx_
      if (m[5]) {
        let token = m[5]
        // STRONG: __xxx__
        if(token.startsWith("__") && token.endsWith("__")){
          // !Head-Text
          if (pos < m.index) {
            let text = markdown.substring(pos, m.index);
            new CheapTextNode(text, this)
          }
          new CheapStrongElement(this).setText(token.substring(2, token.length-2))
          pos = m.index + m[0].length
        }
        // EM: _xxx_
        else if(token.startsWith("_") && token.endsWith("_")){
          // !Head-Text
          if (pos < m.index) {
            let text = markdown.substring(pos, m.index);
            new CheapTextNode(text, this)
          }
          new CheapEmphasisElement(this).setText(token.substring(1, token.length-1))
          pos = m.index + m[0].length
        }
        // Normal Text
        continue
      }
      //....................................
      // !Head-Text
      if (pos < m.index) {
        let text = markdown.substring(pos, m.index);
        new CheapTextNode(text, this)
      }
      // I: *xxx*
      if (m[1]) {
        new CheapItalicElement(this).setText(m[2])
      }
      // B: **xxx**
      else if (m[3]) {
        new CheapBoldElement(this).setText(m[4])
      }
      // DEL: ~~xxx~~
      else if (m[9]) {
        new CheapDeletedTextElement(this).setText(m[10])
      }
      // CODE: `xxx`
      else if (m[11]) {
        let s2 = m[12]
        new CheapCodeElement(this).setText(s2)
      }
      // IMG or Video: ![](xxxx)
      else if(m[13]) {
        // console.log("found image", m[13], m[0])
        let alt = _.trim(m[14])
        let src = _.trim(m[15])
        let attrs = {src, alt}

        // Customized width/height
        // [100-50]
        let m2 = /^([\d.]+(px|%|rem|em)?)(-([\d.]+(px|%|rem|em)?))?(:(.*))?$/.exec(alt);
        if(m2){
          attrs.width  = m2[1]
          attrs.height = m2[4]
          attrs.alt    = m2[7]
        }

        // remove alt if blank
        attrs = _.omitBy(attrs, v => !v)


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
      else if (m[16]) {
        let href = m[18]
        let text = m[17]
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
      else if(m[19]) {
        let refer = m[21]
        let text = m[20]
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
      else if(m[22]) {
        let href = m[22]
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
  getMarkdown(){return `**${super.getMarkdown()}**`}
}
class CheapItalicElement extends CheapElement {
  constructor(parentNode=null) {
    super("I", "inline", {}, parentNode)
  }
  getMarkdown(){return `*${super.getMarkdown()}*`}
}
class CheapStrongElement extends CheapElement {
  constructor(parentNode=null) {
    super("STRONG", "inline", {}, parentNode)
  }
  getMarkdown(){return `__${super.getMarkdown()}__`}
}
class CheapEmphasisElement extends CheapElement {
  constructor(parentNode=null) {
    super("EM", "inline", {}, parentNode)
  }
  getMarkdown(){return `_${super.getMarkdown()}_`}
}
class CheapDeletedTextElement extends CheapElement {
  constructor(parentNode=null) {
    super("DEL", "inline", {}, parentNode)
  }
  getMarkdown(){return `~~${super.getMarkdown()}~~`}
}
class CheapCodeElement extends CheapElement {
  constructor(parentNode=null) {
    super("CODE", "inline", {}, parentNode)
  }
  getMarkdown(){return `\`~~${super.getMarkdown()}~~\``}
}
class CheapAnchorElement extends CheapElement {
  //---------------------------------------------------
  constructor(parentNode=null) {
    super("A", "inline", {}, parentNode)
  }
  //---------------------------------------------------
  getMarkdown(){
    let ref  = this.getAttr("refer")
    let href = this.getAttr("href")
    let text = this.getText()
    let newT = this.isAttr("target", "_blank")
    if(href == text){
      return href
    }
    if(newT) {
      text = "+" + text
    }
    if(ref) {
      return `[${text}][${ref}]`
    }
    return `[${text}](${href})`
  }
  //---------------------------------------------------
  getRuntimeAttrs({anchorHref}={}) {
    let attrs = _.assign({}, this.attrs)
    // Explain refers
    if(attrs.refer) {
      let href = this.document().getRefer(attrs.refer)
      attrs.href = href
    }
    // Eval to real href
    if(attrs.href) {
      attrs.href = anchorHref(attrs.href)
    }
    // Done
    return attrs
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapMediaElement extends CheapElement {
  //---------------------------------------------------
  constructor(tagName, display, setup, parentNode=null) {
    super(tagName, display, setup, parentNode)
  }
  //---------------------------------------------------
  getMarkdown(){
    let src  = this.getAttr("src")
    let size = _.without([
      this.getAttr("width",null),
      this.getAttr("height",null)
    ], null)
    let alts = _.without([
      size.join("-"), this.getAttr("alt", "")
    ], "")

    return `![${alts.join(":")}](${src})`
  }
  //---------------------------------------------------
  getRuntimeAttrs({mediaSrc}={}) {
    let attrs = _.assign({}, this.attrs)
    // Eval to real src
    if(attrs.src) {
      attrs.src = mediaSrc(attrs.src)
    }
    // Done
    return attrs
  }
  //---------------------------------------------------
}
class CheapImageElement extends CheapMediaElement {
  constructor(parentNode=null) {
    super("IMG", "inline", {closeBy:"Self"}, parentNode)
  }
}
class CheapVideoElement extends CheapMediaElement {
  constructor(parentNode=null) {
    super("VIDEO", "inline", {
      attrs: {controls:true}
    }, parentNode)
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
    super("HR", "block", {closeBy:"Self"},  parentNode)
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
      mds.push("```", this.getCodeType(""), "\n")
    }
    for(let nd of this.children){
      mds.push(prefix + nd.getMarkdown())
    }
    if(this.isGFMCode()) {
      mds.push("```")
    }
    return mds.join("")
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
    this.$body = new CheapBodyElement(this)
    this.$meta = {}
    this.$refs = {}
  }
  //---------------------------------------------------
  getBodyElement() {
    return this.$body
  }
  //---------------------------------------------------
  getRefer(name, dft) {
    return this.$refs[name] || dft
  }
  //---------------------------------------------------
  setRefer(name, value) {
    let k = _.trim(name)
    let v = _.trim(value)
    this.$refs[k] = v
  }
  //---------------------------------------------------
  getMeta(name, dft) {
    return this.$meta[name] || dft
  }
  //---------------------------------------------------
  setMeta(name, value) {
    let k = _.trim(name)
    let v = _.trim(value)
    this.$meta[k] = v
  }
  //---------------------------------------------------
  pushMetaValue(name, value) {
    let k = _.trim(name)
    let v = _.trim(value)
    let vs = this.$meta[k]
    if(!_.isArray(vs)) {
      vs = vs ? [vs] : []
      this.$meta[k] = vs
    }
    vs.push(v)
  }
  //---------------------------------------------------
  /***
   * @param mediaSrc{Function}: `F(src, CheapElement)`
   * @param anchorHref{Function}: `F(href, CheapElement)`
   * @param indent{Number}: indent space number
   * 
   * @return document body innerHTML
   */
  toBodyInnerHtml({
    mediaSrc   = _.identity,
    anchorHref = _.identity,
    indent     = 2
  }={}) {
    return this.$body.getInnerHtml({mediaSrc, anchorHref, indent})
  }
  //---------------------------------------------------
  toString() {
    let ss = []
    if(!_.isEmpty(this.$meta)) {
      ss.push(JSON.stringify(this.$meta, null, "   "))
      ss.push(_.repeat('*', 60))
    }

    ss.push(this.$body.toString())

    if(!_.isEmpty(this.$refs)) {
      ss.push(_.repeat('*', 60))
      ss.push(JSON.stringify(this.$refs, null, "   "))
    }

    return ss.join("\n")
  }
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapBlock {
  //---------------------------------------------------
  constructor({
    indentAsCode = 4,   // how many indent as code block
    tabIndent = 4,      // TAB key indent value
    ulIndent  = 2,
    olIndent  = 3,
  }={}){
    this.indentAsCode = indentAsCode
    this.tabIndent  = tabIndent
    this.ulIndent = ulIndent
    this.olIndent = olIndent
    this.reset()
  }
  //---------------------------------------------------
  isEmpty() {
    return this.$top ? false : true
  }
  //---------------------------------------------------
  reset() {
    this.$top = null
    this.$tbody = null
    this.$li = null
    this.lastPushBlank = false
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
  pushLine(line="", trimed="") {
    try {
      return this.__do_push_line(line, trimed)
    }
    // Warn
    catch(E) {
      console.error("invalid line:", line)
      throw E
    }
    // mark
    finally {
      this.lastPushBlank = trimed ? false : true
    }
  }
  //---------------------------------------------------
  /***
   * @return {repush, closed}
   */
  __do_push_line(line="", trimed="") {
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
          this.$top.addCodeLine(line+"\n")
        }
      }
      // Indent code
      else {
        // Still indent code
        if(cI > 0) {
          let codeLine = line.substring(cI)
          this.$top.addCodeLine(codeLine+"\n")
        }
        // Quit indent
        else {
          return {repush:true, closed:true}
        }
      }
      return
    }
    //.................................................
    // >>> List
    if(this.$li) {
      // Close the list
      if(!trimed) {
        return {closed: this.lastPushBlank}
      }
      //-----------------------------------
      // eval current line
      let start = undefined;
      m = /^(([*+-])|(\d)\.) +(.+)$/.exec(trimed)
      if(m) {
        start = m[3] * 1
      }
      //-----------------------------------
      let listIndent = !isNaN(start) ? this.olIndent : this.ulIndent
      //-----------------------------------
      // Prepare to join
      let liDepth = this.$li.getAttr("depth")
      let myDepth = parseInt(indent / listIndent)
      let $list;
      //-----------------------------------
      // Normal paragraph
      if(_.isUndefined(start)) {
        if(myDepth == 0 && this.lastPushBlank) {
          return {closed:true, repush:true}
        }
      }
      //-----------------------------------
      // Child
      else if(myDepth > liDepth) {
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
        let $li = this.$li
        do {
          $li = $li.parentNode.parentNode
          if(!$li)
            break
          $list = $li.parentNode
        } while($li && $li.isTag("LI") && $li.getAttr("depth")>myDepth)
        // Repush
        if(!$li || !$li.isTag("LI")){
          return {closed:true, repush:true}
        }
      }
      //-----------------------------------
      // Create new list if necessary
      if(!$list) {
        // <P>
        if(_.isUndefined(start)) {
          if(this.lastPushBlank) {
            $list = new CheapParagraphElement(this.$li)
          }
          // Just append to current li
          else {
            $list = this.$li
          }
        }
        // <UL>
        else if(isNaN(start)) {
          $list = new CheapUnorderedListElement(this.$li)
        }
        // <OL>
        else {
          $list = new CheapOrderedListElement(this.$li)
          $list.setAttr({start})
        }
      }
      //-----------------------------------
      // <OL | UL> append children
      if($list instanceof CheapListElement) {
        this.$li = new CheapListItemElement($list)
        this.$li.setAttr({
          indent,
          depth : parseInt(indent / listIndent)
        })
        let text = _.trim(trimed.substring(2))
        this.$li.appendMarkdown(text+"\n")
      }
      //-----------------------------------
      // <P> append children
      else {
        $list.appendMarkdown(trimed+"\n")
      }
      //-----------------------------------
      return
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
      $row.appendMarkdown(trimed+"\n")
      return
    }
    //.................................................
    // Heading : H1~6
    m = /^(#{1,})[\t ]+(.*)$/.exec(trimed)
    if(m) {
      let n = m[1].length
      this.$top = new CheapSectionHeadingElement(n)
      this.$top.appendMarkdown(m[2]+"\n")
      return {closed:true}
    }
    //.................................................
    // Indent Code
    if(cI > 0) {
      this.$top = new CheapPreformattedTextElement()
      this.$top.setAttr({mode: "MARKDOWN"})
      let codeLine = line.substring(cI)
      this.$top.addCodeLine(codeLine+"\n")
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
      this.$top.appendMarkdown(text+"\n")
      return
    }
    //.................................................
    // UL / OL
    m = /^(([*+-])|(\d)\.) +(.+)$/.exec(trimed)
    if(m) {
      if(!this.isEmpty()){
        return {closed:true, repush:true}
      }
      // Create top OL/UL
      let start = m[3] * 1
      // Count the indent
      let listIndent = !isNaN(start) ? this.olIndent : this.ulIndent
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
        depth : parseInt(indent / listIndent)
      })
      // append list item content
      let text = _.trim(trimed.substring(2))
      this.$li.appendMarkdown(text+"\n")
      return
    }
    //.................................................
    // TABLE
    if(/^([ |:-]{6,})$/.test(trimed) && !this.isEmpty()) {
      let header = this.$top.getMarkdown()
      this.$top = new CheapTableElement();
      let $thead = new CheapTableHeadElement(this.$top)
      let $h_row = new CheapTableRowElement($thead)
      $h_row.appendMarkdown(header)

      this.$tbody = new CheapTableBodyElement(this.$top)
      return
    }
    //.................................................
    // Normal paragraph
    if(this.isEmpty()) {
      this.$top = new CheapParagraphElement()
    }
    this.$top.appendMarkdown(line+"\n")
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
    // Normal line
    else {
      lnIndex --
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
      let [k, ...v] = trimed.split(":")
      MdDoc.setMeta(k, _.trim(v.join(":")))
      lastMetaKey = k
    }
  }
  //.................................................
  // Scan document body
  for(; lnIndex < lines.length; lnIndex++) {
    let line = lines[lnIndex]
    let trimed = _.trim(line)

    // Link Refer 
    let m = /^\[([^\]]+)\]:(.+)$/.exec(trimed)
    if(m) {
      let name  = _.trim(m[1])
      let refer = _.trim(m[2])
      MdDoc.setRefer(name, refer)
      continue
    }

    // Elements
    let {repush, closed} = block.pushLine(line, trimed) || {}

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
  // Tail Block
  if(!block.isEmpty()){
    MdDoc.$body.appendChild(block.$top)
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
