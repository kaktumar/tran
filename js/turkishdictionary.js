"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

/*
  Translation engine: http://www.turkishdictionary.net
  For translating turkish-russian and vice versa
*/
var CHAR_CODES = require("./char-codes-turk.js");

var TurkishDictionary = (function () {
  function TurkishDictionary() {
    this.host = "http://www.turkishdictionary.net/?word=%FC";
    this.path = "";
    this.protocol = "http";
    this.query = "&s=";
    this.TABLE_CLASS = "___mtt_translate_table";
    // this flag indicates that if translation was successful then publish it all over extension
    this.need_publish = true;
  }

  _prototypeProperties(TurkishDictionary, null, {
    search: {
      value: function search(data) {
        data.url = this.makeUrl(data.value);
        this.need_publish = false;
        return this.request(data);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    translate: {
      value: function translate(data) {
        data.url = this.makeUrl(data.selectionText);
        this.need_publish = true;
        this.request(data);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    makeUrl: {
      value: function makeUrl(text) {
        var text = this.getEncodedValue(text);
        return ["http://www.turkishdictionary.net/?word=", text].join("");
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    getEncodedValue: {


      // Replace special language characters to html codes
      value: function getEncodedValue(value) {
        // to find spec symbols we first encode them (raw search for that symbol doesn't wor)
        return encodeURIComponent(value);
        //return this.makeStringTransferable(value);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    makeStringTransferable: {

      /** converting script from the turkishdict */
      value: function makeStringTransferable(inputText) {
        var text = "";
        if (inputText.length > 0) {
          text = inputText;
          for (var i = 0; i < text.length; i++) {
            if (CHAR_CODES[text.charCodeAt(i)]) {
              text = text.substring(0, i) + CHAR_CODES[text.charCodeAt(i)] + text.substring(i + 1, text.length);
            } else if (text.charAt(i) == " ") {
              // replace spaces
              text = text.substring(0, i) + "___" + text.substring(i + 1, text.length);
            }
          }
        }
        return text;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    request: {

      /*
        Request translation and run callback function
        passing translated result or error to callback
      */
      value: function request(opts) {
        console.log("start request");
        this.xhr = new XMLHttpRequest();
        this.xhr.onreadystatechange = this.onReadyStateChange.bind(this, opts);
        this.xhr.open("GET", opts.url, true);
        this.xhr.send();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onReadyStateChange: {
      value: function onReadyStateChange(opts, e) {
        var xhr = this.xhr;
        if (xhr.readyState < 4) {
          return;
        } else if (xhr.status != 200) {
          this.errorHandler(xhr);
          return opts.error && opts.error();
        } else if (xhr.readyState == 4) {
          var translation = this.successHandler(e.target.response);
          console.log("success turkish translate", translation);
          console.log("call", opts.success);
          return opts.success && opts.success(translation);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    successHandler: {
      value: function successHandler(response) {
        var data = this.parse(response);
        if (this.need_publish) {
          chrome.tabs.getSelected(null, this.publishTranslation.bind(this, data));
        }
        return data;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    publishTranslation: {

      /* publish successfuly translated text all over extension */
      value: function publishTranslation(translation, tab) {
        console.log("publish translation");
        chrome.tabs.sendMessage(tab.id, {
          action: this.tooltipAction(translation),
          data: translation.outerHTML,
          success: !translation.classList.contains("failTranslate")
        });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    tooltipAction: {
      value: function tooltipAction(translation) {
        if (translation.textContent.trim().indexOf("was not found in our dictionary") != -1) {
          console.log("similar words");
          return "similar_words";
        } else {
          console.log("open tooltip");
          return "open_tooltip";
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    errorHandler: {
      value: function errorHandler(response) {
        console.log("error ajax", response);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parse: {

      /* Parse response from translation engine */
      value: function parse(response, silent, translate) {
        var doc = this.stripScripts(response),
            fragment = this.makeFragment(doc);
        if (fragment) {
          translate = fragment.querySelector("#meaning_div > table");
          if (translate) {
            translate.className = this.TABLE_CLASS;
            translate.setAttribute("cellpadding", "5");
            // @fixImages(translate)
            // @fixLinks(translate)
          } else if (!silent) {
            translate = document.createElement("div");
            translate.className = "failTranslate";
            translate.innerText = "Unfortunately, could not translate";
          }
        }
        return translate;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parseText: {

      /** parsing of terrible html markup */
      value: function parseText(response, silent, translate) {
        var _this = this;
        var doc = this.stripScripts(response),
            fragment = this.makeFragment(doc);

        if (fragment) {
          var i;
          var _ret = (function () {
            var stopIndex = null;
            var tr = fragment.querySelectorAll("#meaning_div>table>tbody>tr");
            tr = Array.prototype.slice.call(tr);

            var trans = tr.filter(function (tr, index) {
              if (!isNaN(parseInt(stopIndex, 10)) && index >= stopIndex) {
                return;
              } else {
                tr = $(tr);
                // take every row before next section (which is English->English)
                if (tr.attr("bgcolor") == "e0e6ff") {
                  stopIndex = index;return;
                } else {
                  return $.trim(tr.find("td").text()).length;
                }
              }
            });
            trans = trans.slice(1, trans.length - 1);
            trans = trans.filter(function (el, indx) {
              return indx % 2;
            });
            var frag = _this.fragmentFromList(trans);
            var fonts = frag.querySelectorAll("font");
            var text = "";
            for (i = 0; i < fonts.length; i++) {
              text += " " + fonts[i].textContent.trim();
            }
            return {
              v: text
            };
          })();

          if (typeof _ret === "object") return _ret.v;
        } else {
          throw "HTML fragment could not be parsed";
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    stripScripts: {

      //TODO extract to base engine class
      /* removes <script> tags from html code */
      value: function stripScripts(html) {
        var div = document.createElement("div");
        div.innerHTML = html;
        var scripts = div.getElementsByTagName("script");
        var i = scripts.length;
        while (i--) scripts[i].parentNode.removeChild(scripts[i]);
        return div.innerHTML;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    makeFragment: {

      //TODO extract to base engine class
      /* creates temp object to parse translation from page 
        (since it's not a friendly api) 
      */
      value: function makeFragment(html) {
        var fragment = document.createDocumentFragment(),
            div = document.createElement("div");
        div.innerHTML = html;
        while (div.firstChild) {
          fragment.appendChild(div.firstChild);
        }
        return fragment;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    fragmentFromList: {

      /** create fragment from list of DOM elements */
      value: function fragmentFromList(list) {
        var fragment = document.createDocumentFragment(),
            len = list.length;
        while (len--) {
          fragment.appendChild(list[len]);
        }
        return fragment;
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return TurkishDictionary;
})();

// Singletone
module.exports = new TurkishDictionary();