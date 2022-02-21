import Dot from './dot'

class DotsBackground {

    constructor(p5) {
        this.p5 = p5;
        this.growingDots = [];
        this.shrinkingDots = [];
        this.growthThresholds = [];
        this.color1 = p5.color(52, 235, 232, p5.random(0.1,0.3)*255)
        this.color2 = p5.color(52, 235, 76, p5.random(0.1,0.3)*255)
    }

    update() {

        //spawn a dot every 30 frames
        if (this.p5.frameCount % 30 === 0 && this.growingDots.length < 100){
            let gradient = this.p5.lerpColor(this.color1, this.color2, this.p5.random(1))
            let newDot = new Dot(this.p5, this.p5.random(this.p5.width), this.p5.random(this.p5.height), 1, true, 1, gradient)
            this.growingDots.push(newDot)
            this.growthThresholds.push(this.p5.random(80, 150))
        }

        // shrink dots
        for (let dot of this.shrinkingDots) {
            dot.shrink()
            if (dot.diameter <= 10){
                this.shrinkingDots = this.shrinkingDots.filter((elem) => (elem !== dot))
            }
        }

        // grow dots
        let shrinkedDotsIndices = []
        for (let dotIndex in this.growingDots) {
            let dot = this.growingDots[dotIndex]
            dot.grow();
            if (dot.diameter > this.growthThresholds[dotIndex]) {
                shrinkedDotsIndices.push(dotIndex)
                this.shrinkingDots.push(dot)
            }
        }

        // remove dots that have passed a threshold
        for (let index of shrinkedDotsIndices) {
            this.growingDots = this.growingDots.filter(elem => elem !== this.growingDots[index])
            this.growthThresholds = this.growthThresholds.filter(elem => elem !== this.growthThresholds[index])
        }

    }

    show(){
        // this.p5.text(this.p5.frameCount, 40,40)
        for (let dot of this.growingDots){
            dot.show()
        }
        for (let dot of this.shrinkingDots) {
            dot.show()
        }
    }
}

export default DotsBackground;
