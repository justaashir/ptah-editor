import merge from 'lodash-es/merge'
import Section from './section'
import VuseBuilder from './components/VuseBuilder.vue'
import VuseRenderer from './components/VuseRenderer.vue'
import styler from './styler'
import mixin from './mixin'
import { cleanDOM } from './util'
import * as _ from 'lodash-es'

let PLUGINS = []
let mixier = {}
const BUILDER_OPTIONS = {
  landing: '',
  title: '',
  intro: true,
  sections: [],
  plugins: [],
  themes: [],
  columnsPrefix: {
    mobile: 'is-mobile-',
    tablet: 'is-tablet-',
    desktop: 'is-desktop-',
    widescreen: 'is-widescreen-',
    ultrawide: 'is-ultrawide-'
  }
}

// To tell if it is installed or not
let _Vue = null

class Vuse {
  constructor (options) {
    this.isEditing = true
    this.isRendered = false
    this.title = options.title
    this.landing = options.landing
    this.intro = options.intro
    this.sections = options.sections
    this.columnsPrefix = options.columnsPrefix
    this.themes = options.themes
    this.components = {}
    this.assets = {
      css: options.css,
      js: options.js || './../js/cjs.js'
    }
    this.installPlugins()
  }

  /**
     * Creates and adds a new section to the list of sections.
     * @param {*} options
     */
  add (options, position) {
    if (position !== undefined) {
      this.sections.splice(position, 0, new Section(options))
      return
    }
    this.sections.push(new Section(options))
  }

  /**
     * Finds a section with the specified id.
     *
     * @param {String|Number} id
     */
  find (id) {
    return this.sections.find(s => s.id === id)
  }

  /**
     * Removes a section with the specified id.
     * @param {String|Number} id
     */
  remove (section) {
    const id = this.sections.findIndex(s => s.id === section.id)
    this.sections.splice(id, 1)
    section.destroy()
  }

  /**
     * Removes a section with the specified id.
     * @param {String|Number} oldIndex
     * @param {String|Number} newIndex
     */
  sort (oldIndex, newIndex) {
    const section = this.sections[oldIndex]
    this.sections.splice(oldIndex, 1)
    this.sections.splice(newIndex, 0, section)
  }

  /**
     * Constructs a document fragment.
     */
  outputFragment () {
    const frag = document.createDocumentFragment()
    frag.appendChild(document.head.cloneNode(true))
    frag.appendChild(this.rootEl.cloneNode(true))

    return frag
  }

  /**
     * clears the builder sections.
     */
  clear () {
    const tempSections = this.sections
    this.sections.forEach(section => section.destroy())
    this.sections = []
    return tempSections
  }

  /**
     * Static helper for components registration pre-installation.
     *
     * @param {String} name
     * @param {Object} definition
     */
  static component (name, definition) {
    // Just make a plugin that installs a component.
    Vuse.use((ctx) => {
      ctx.builder.component(name, definition)
    })
  }

  /**
     * Acts as a mixin for subcomponents.
     * @param {Object} mixinObj
     */
  static mix (mixinObj) {
    mixier = merge(mixier, mixinObj)
  }

  /**
     * Adds a component section to the builder and augments it with the styler.
     * @param {*} name
     * @param {*} definition
     */
  component (name, definition) {
    // reoslve the component name automatically.
    if (typeof name === 'object') {
      definition = name
      name = definition.name
    }

    // if passed a plain object
    if (!definition.extend) {
      definition = _Vue.extend(definition)
    }

    this.components[name] = definition.extend({
      directives: { styler: this.styler },
      mixins: [this.mixin],
      components: mixier.components
    })
  }

  /**
   * Installs added plugins.
   */
  installPlugins () {
    PLUGINS.forEach((ctx) => {
      ctx.plugin({ builder: this, Vue: _Vue }, ctx.options)
    })
    // reset to prevent duplications.
    PLUGINS = []
  }

  static install (Vue, options = {}) {
    // already installed
    if (_Vue) return

    _Vue = Vue
    const builder = new Vuse(Object.assign({}, BUILDER_OPTIONS, options))
    // configer assets output location
    Vue.util.defineReactive(builder, 'sections', builder.sections)
    Vue.util.defineReactive(builder, 'isEditing', builder.isEditing)
    const extension = {
      components: builder.components,
      beforeCreate () {
        this.$builder = builder
      }
    }

    // register the main components.
    Vue.component('VuseBuilder', Vue.extend(VuseBuilder).extend(extension))
    Vue.component('VuseRenderer', Vue.extend(VuseRenderer).extend(extension))
  }

  /**
   * The plugin to be installed with the builder. The function receives the installation context which
   * contains the builder instance and the Vue prototype.
   *
   * @param {Function} plugin
   * @param {Object} options
   */
  static use (plugin, options = {}) {
    if (typeof plugin !== 'function') {
      return console.warn('Plugins must be a function')
    }

    // append to the list of to-be installed plugins.
    PLUGINS.push({ plugin, options })
  }

  set (data) {
    this.title = data.title !== undefined ? data.title : this.title

    if (data.sections && Array.isArray(data.sections)) {
      this.sections = data.sections.map(section => {
        let component
        let sectionData

        if (typeof section === 'string') {
          component = this.components[section].options
          sectionData = {
            name: component.name,
            group: component.group,
            schema: component.schema
          }
          if (!sectionData.schema) {
            sectionData.schema = this.components[sectionData.name].options.$schema
          }
        } else {
          // restore saved data
          component = this.components[section.name].options
          sectionData = {
            name: component.name,
            group: component.group,
            schema: component.schema,
            data: section.data,
            isHeader: component.isHeader
          }
          if (!sectionData.schema) {
            sectionData.schema = this.components[sectionData.name].options.$schema
          }
        }

        return new Section(sectionData)
      })
    }
  }

  /**
   * Outputs a JSON representation of the builder that can be used for rendering with the renderer component.
   */
  toJSON () {
    return JSON.stringify({
      slug: this.landing,
      title: this.title,
      settings: this.settings,
      sections: this.sections.map(({ name, data }) => ({
        name,
        data: _.mapValues(data, (value, key) => {
          // --- coz html element in component's array has circular structure
          if (key.match(/^components/)) {
            return value.map(c => {
              if (c.element.hasOwnProperty('element') && c.element.element instanceof HTMLElement) {
                c.element.element = c.element.element.cloneNode(true)
              }
              return c
            })
          }
          return value
        })
      }))
    })
  }

  /**
   * Previews the created page in a seperate tap/window.
   */
  preview () {
    const frag = this.outputFragment()
    const artboard = frag.querySelector('#artboard')
    const printPreview = window.open('about:blank', 'print_preview')
    const printDocument = printPreview.document

    void cleanDOM(frag)

    let { video, title } = this.settings
    let customCss = this.getCustomCss()
    let script = this.getJsScript()
    let bodyStyles = this.getBodyStyles()
    let scrollSetup = this.getScrollSetup()

    printDocument.open()
    printDocument.write(
      `<!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="${window.location.origin}/ptah_sections.css">
            <link href="https://fonts.googleapis.com/css?family=Lato|Heebo|PT+Serif|Montserrat:400,500|Roboto:400,700|Cinzel:400,700|IBM+Plex+Sans:400,600|IBM+Plex+Mono:400,600&amp;subset=cyrillic" rel="stylesheet">
            ${scrollSetup.style}
            <style>
              ${customCss}
            </style>
          </head>
          <body class="b-body_preview" style="${bodyStyles}">
            ${(video) ? this.getVideoBg(video) : ''}
            <div id="main" class="main">
              ${artboard.innerHTML}
            </div>
            ${this.getCookiesPreview()}
            ${scrollSetup.setup}
            <script>
              ${script}
            </script>
            <script src="${window.location.origin + '/js/cjs.js'}"></script>
          <body>
        </html>`
    )
  }

  getCookiesPreview () {
    let { enabled, pdf } = this.settings.cookiesPolicy
    if (!enabled || !pdf) {
      return ''
    }
    return `
      <div id="cookies-policy" class="cookies-policy">
        <span id="cookies-policy-close" class="cookies-policy__close">&times;</span>
        <h2 class="cookies-policy__title">Cookies policy</h2>
        <p class="cookies-policy__description">
          This website uses cookies.
          If you do not wish us to set cookies on your device, please do not use the website.
          Please read the <a href="${pdf}" target="_blank">Cookies Policy</a> for more information.
        </p>
      </div>
    `
  }

  getCustomCss () {
    if (!!this.settings.css) {
      return this.settings.css
    } else {
      return ''
    }
  }

  getJsScript () {
    if (!!this.settings.script) {
      return this.settings.script
    } else {
      return ''
    }
  }

  /**
   * get inline body styles
   * @returns {string}
   */
  getBodyStyles () {
    if (!!this.settings.styles) {
      let styles = ''
      Object.keys(this.settings.styles).forEach((i) => {
        if (this.settings.styles[i] && i !== 'backgroundImage')
          styles =  styles + `${_.kebabCase(i)}: ${this.settings.styles[i]};`
        if (this.settings.styles[i] && i === 'backgroundImage')
          styles =  styles + `${_.kebabCase(i)}: url(${this.settings.styles[i]});`
      })
      if (this.settings.fullPageScroll === 'yes') {
        styles += `overflow:hidden!important;`
      }
      return styles
    } else {
      return ''
    }
  }

  getVideoBg (video) {
    return `<video id="video_bg" class="${this.settings.videoPosition}" autoplay="true" loop="loop" muted="muted">
              <source src="${video}" type="video/mp4"></source>
            </video>`
  }

  getScrollSetup () {
    let scroll = {
      style: '',
      setup: ''
    }

    if (this.settings.fullPageScroll === 'yes') {
      scroll.style = `
        <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
        <script src="${window.location.origin + '/js/onepage-scroll.min.js'}"></script>
        <link href="${window.location.origin + '/css/onepage-scroll.css'}" rel="stylesheet">
      `
      scroll.setup = `
        <script>
          function detectMobile () {
            return $(window).width() < 500 ? true : false;
          }

          if (!detectMobile()) {
            $(".main").onepage_scroll();
          }

          $(window).resize(function() {
            let className = 'disabled-onepage-scroll';
            let classWrapName = 'onepage-wrapper';

            if (detectMobile()) {
              if ($(".main").data("onepage_scroll")){
                $(".main").disable();
                $(".main").data("onepage_scroll").destroy();

                if ($(".main").hasClass(classWrapName)) $(".main").removeClass(classWrapName);
              }
              $("body").addClass(className);
              $("body").css('overflow', '')

            } else {
              if (!$(".main").data("onepage_scroll")){
                $(".main").onepage_scroll();
              }

              $("body").css('overflow', 'hidden');

              if ($("body").hasClass(className)) $("body").removeClass(className);
            }
          });
      </script>`
    }

    return scroll
  }

  gtmSetup () {
    let setup = {
      head: '',
      body: ''
    }

    if (this.settings.gtmId.length) {
      setup.head = `<!-- Google Tag Manager -->
                    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                    })(window,document,'script','dataLayer','${this.settings.gtmId}');</script>
                    <!-- End Google Tag Manager -->`
      setup.body =`<!-- Google Tag Manager (noscript) -->
                    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${this.settings.gtmId}"
                    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
                    <!-- End Google Tag Manager (noscript) -->`
    }

    return setup
  }

  getManifest () {
    let description = _.find(this.settings.ogTags, o => o.property === 'og:description') || { content: '' }
    let manifest = {
      name: this.settings.title,
      description: description.content,
      icons: [{
        src: this.settings.favicon,
        sizes: '64x64'
      }],
      start_url: '.'
    }

    return JSON.stringify(manifest)
  }

  /**
   * Return open graph meta tags
   * @param tags
   * @returns {string}
   */
  getOgMetaTags (tags) {
    let og = ''
    tags.forEach((i) => {
      og = og + `<meta property="${i.property}" content="${i.content}">`
    })
    return og
  }

  /**
     * Exports the builder instance to a specified output. default is json.
     *
     * @param {String} method
     */
  export (method = 'json') {
    if (method === 'pwa' || method === 'zip') {
      if (typeof this.download === 'function') {
        return this.download(this.assets)
      }

      return console.warn('You do not have the zip plugin installed.')
    }

    if (method === 'preview') {
      return this.preview()
    }

    return this.toJSON()
  }
};

// use the plugin API to add the styler and mixin functionalities.
Vuse.use(styler)
Vuse.use(mixin)

export default Vuse
