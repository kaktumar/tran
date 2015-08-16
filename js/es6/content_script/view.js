var Tooltip = require('./tooltip.js')
var TEXTBOX_TAGS = ['input', 'textarea']

class Main {
  constructor () {
    window.addEventListener('mousedown', e => this.mouseDownEvent(e))
    document.addEventListener('mousedown', e => this.mouseDownEvent(e))
    window.addEventListener('mouseup', e => this.mouseUpEvent(e))
    document.addEventListener('contextmenu', e => this.saveMousePosition(e))
    this.coordinates = { mouseX: 0, mouseY: 0 };

    this.tooltip = new Tooltip(this.coordinates);

    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg.action == 'open_tooltip' || msg.action == 'similar_words') {
        //don't show annoying tooltip when typing
        if (!msg.success && this.tooltip.clickTarget == 'textbox') {
          return
        } else if (msg.action == 'similar_words') {
          this.tooltip.render(msg.data, this.attachSimilarWordsHandlers);
        } else {
          this.tooltip.render(msg.data)
        }
      }
    });
  }

  requestSearch (selection) {
    chrome.runtime.sendMessage({
      method: "request_search",
      data: {
        selectionText: selection
      }
    })
  }

  saveMousePosition (e) {
    this.coordinates.mouseX = e.pageX + 5
    this.coordinates.mouseY = e.pageY + 10
    this.tooltip.setCoordinates(this.coordinates);
  }

  mouseDownEvent (e) {
    var tag = e.target.tagName.toLowerCase();
    if (TEXTBOX_TAGS.indexOf(tag) != -1) {
      this.tooltip.clickTarget = 'textbox';
    }
  }

  mouseUpEvent (e) {
    // fix for accidental tooltip appearance when clicked on text
    handler = function () {
      this.saveMousePosition(e);
      selection = this.getSelection()
      if (selection.length > 0) {
        chrome.storage.sync.get({fast: true}, function (items) {
          if (items.fast) {
            this.requestSearch(selection);
          }
        });
      }
    }
    setTimeout(handler, 10);
    return true;
  }

  getSelection (e) {
      var txt = window.getSelection().toString();
      var span = document.createElement('SPAN')
      span.innerHTML = txt;
      var selection = span.textContent.trim();
      return selection
  }

  attachSimilarWordsHandlers (fragment) {
    for (let link of fragment.querySelectorAll('a')) {
      // sanitize
      link.removeAttribute('onclick');
      link.onclick = null;
      let clone = link.cloneNode(true);
      link.parentNode.replaceChild(clone, link);
      let word = clone.textContent;
      // Prevent link from being followed.
      clone.addEventListener('click', function (e) {
        e.stopPropagation(); e.preventDefault();
      });
      // Don't let @mouseUpEvent fire again with the wrong word.
      self = this;
      clone.addEventListener('mouseup', function (e) {
        e.stopPropagation()
        self.requestSearch(word);
      })
    }
    return true;
  }
}
module.exports = Main
