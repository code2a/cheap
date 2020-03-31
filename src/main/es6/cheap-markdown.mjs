/******************************************************
 * Cheap Markdown Parser and Render
 * 
 * By zozoh @ 2020
 */
///////////////////////////////////////////////////////
class CheapNode {
  constructor(parentNode=null, nodeType="Element") {
    this.nodeType = nodeType
    this.parentNode = parentNode
    if(parentNode) {
      parentNode.appendChild(this)
    }
  }
  __children() {
    if(!_.isArray(this.children)) {
      this.children = []
    }
    return this.children
  }
  hasChildren() {return !_.isEmpty(this.children)}
  childrenNodes() {
    return this.children
  }
  appendChild(node) {
    this.__children().push(node)
  }
  prependChild(node) {
    this.__children().unshift(node)
  }
}
///////////////////////////////////////////////////////
class CheapText extends CheapNode {
  constructor(parentNode=null, text=""){
    super(parentNode, "Text")
    this.text = text
  }
  appendChild(){
    throw "Text canot append child"
  }
}
///////////////////////////////////////////////////////
class CheapElement extends CheapNode {
  constructor(parentNode=null, tagName="P", display="block", {
    bold=false,
    italic=false,
    underline=false
  }={}) {
    super(parentNode, "Element")
    this.tagName = tagName
    this.display = display
    this.style = {bold, italic, underline}
  }
  //---------------------------------------------------
  
  //---------------------------------------------------
}
///////////////////////////////////////////////////////
class CheapDocument {
  constructor(){
    this.rootElement = new CheapElement(null, "markdown")
    this.meta = {}
  }
}
///////////////////////////////////////////////////////
class CheapBlock {
  
}
class CheapToken {

}
class CheapMeta {

}
///////////////////////////////////////////////////////
class CheapParsing {
  constructor(markdown) {

  }
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
