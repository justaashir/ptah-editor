<script>
import { mapState } from 'vuex'

export default {
  data () {
    return {
      controlOpen: false,
      bgColor: '',
      bgImage: '',
      bgRepeat: '',
      bgSize: '',
      list: [
        { text: 'No-repeat', value: 'no-repeat' },
        { text: 'Repeat', value: 'repeat' }
      ],
      sizeList: [
        { text: 'Tile', value: 'cover' },
        { text: 'Fill', value: 'contain' }
      ]
    }
  },

  created () {
    let image = this.styles['background-image']
    if (image && image !== 'none') {
      let images = image.match(/url\(.+(?=\))/g) || []
      let result = images.map(url => url.replace(/url\(/, ''))[0]
      if (result) {
        this.bgImage = (result.match(/^("")|("")$/)) ? JSON.parse(result) : result
      }
    }
    this.bgColor = this.styles['background-color']
    this.bgRepeat = this.styles['background-repeat'] || 'no-repeat'
    this.bgSize = this.styles['background-size'] || 'cover'
  },

  computed: {
    ...mapState('Sidebar', [
      'settingObjectOptions'
    ]),

    styles () {
      return this.settingObjectOptions.styles
    }

  },

  methods: {
    changeColor () {
      const color = this.bgColor.rgba ? `rgba(${Object.values(this.bgColor.rgba).toString()})` : this.bgColor
      this.styles['background-color'] = color
    },

    changeImage () {
      let bg = 'none'
      if (this.bgImage !== null && this.bgImage !== '') {
        bg = `url(${this.bgImage})`
      }
      this.styles['background-image'] = bg
    },

    changeRepeat () {
      this.styles['background-repeat'] = this.bgRepeat
    },

    changeSize () {
      this.styles['background-size'] = this.bgSize
    }
  }
}
</script>

<template>
  <div class="b-bg-controls">
    <div class="b-bg-controls__control">
      <base-color-picker label="Background color" v-model="bgColor" @change="changeColor"></base-color-picker>
    </div>
    <div class="b-bg-controls__control">
      <base-uploader
          v-model="bgImage"
          @change="changeImage"
          label="Background image"/>
    </div>
    <div class="b-bg-controls__control">
      <BaseButtonTabs :list="list" v-model="bgRepeat" @change="changeRepeat"/>
    </div>
    <div class="b-bg-controls__control">
      <BaseButtonTabs :list="sizeList" v-model="bgSize" @change="changeSize"/>
    </div>
  </div>
</template>

<style lang="sass" scoped>
  .b-bg-controls
    &__header
      font-size: 1.6rem
      height: 3.2rem
      color: #272727
      display: flex
      align-items: center
      cursor: pointer
      i
        margin-left: 5px
        margin-bottom: -5px
        transform: rotate(180deg)
        &.dropped
          transform: rotate(0deg)
    &__control
      margin-top: 2.2rem
</style>
