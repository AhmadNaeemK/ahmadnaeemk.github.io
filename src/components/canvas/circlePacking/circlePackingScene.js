import Dot from './dot'

class CirclePackingScene {

    constructor(p5, textFont, text) {
        this.p5 = p5;
        this.text = text;

        this.dots = [];
        this.attempts = 0;
        this.allowAddDots = true;

        this.fontSize = this.getFontSize(p5.width);

        this.textPoints = textFont.textToPoints(text, 100, 200, this.fontSize, {
            sampleFactor: 1,
            simplifyThreshold: 0,
        });
        this.textBounds = textFont.textBounds(text, 100, 200, this.fontSize);

        this.color1 = p5.color(52, 235, 232)
        this.color2 = p5.color(52, 235, 76)
    }

    getFontSize(width) {
        let fontSize = width / 8;
        if (width < 650) {
            fontSize = 70;
        }
        return fontSize;
    }

    giveProbability(chance) {
        return (Math.random(0, 1) > chance)
    }

    addDot() {
        let newPoint = this.textPoints[Math.floor(this.p5.random(this.textPoints.length))]
        if (newPoint) {
            let gradient = this.p5.lerpColor(this.color1, this.color2, this.p5.random(1,10)/10)
            let newDot = new Dot(this.p5, newPoint.x, newPoint.y, 1 / 2, this.giveProbability(0.3), this.p5.width/9000, gradient)
            if (!newDot.checkCanvasEdge() && !newDot.checkDotsEdge(this.dots)) {
                this.dots.push(newDot);
                this.attempts = 0;
            } else this.attempts++;
            this.textPoints = this.textPoints.filter((elem) => elem !== newPoint)
        }
    }

    show() {
        this.p5.push();
        this.p5.translate(this.p5.width / 2, this.p5.height / 2);
        this.p5.translate(-this.textBounds.x - this.textBounds.w / 2, -this.textBounds.y - this.textBounds.h / 2);
        for (let dot of this.dots) {
            if (!dot.checkCanvasEdge() && !dot.checkDotsEdge(this.dots)) {
                dot.grow();
            }
            dot.show();
        }
        this.p5.pop();
    }

    update() {
        // create multiple points in one frame
        if (this.allowAddDots) {
            if (this.attempts > 1000 || this.textPoints.length <= 1) {
                this.allowAddDots = false;
                console.log("Finished")
                return
            }
            for (let i = 0; i < 5; i++) {
                this.addDot(this.p5)
            }
        }
    }

}

export default CirclePackingScene;