class Dot {

    constructor(p5, x, y, diameter, outline) {
        this.p5 = p5;
        this.x = x;
        this.y = y;
        this.diameter = diameter;
        this.growable = true;
        this.outline = outline;
    }

    grow() {
        this.diameter += 0.05 ;
    }

    shrink() {
        this.diameter--;
        if (this.diameter <= 1) {
            this.diameter = 2;
        };
    }

    checkCanvasEdge() {
        return(this.x + this.diameter/2 >= this.p5.width || this.x - this.diameter/2 <= 0 ||
            this.y + this.diameter/2 >= this.p5.height || this.y - this.diameter/2 <= 0
            )
    }

    checkDotsEdge(dots) {
        for (let dot of dots) {
            let dist = this.getDistFromDot(dot);
            if (dist < this.diameter/2 + dot.diameter/2 && dot !== this) {
                this.growable = false
                return true;
            }
        }
        return false;
    }

    checkPointAvailability(dots) {
        for (let dot of dots) {
            let dist = this.getDistFromDot(dot);
            if (dist < dots.diameter/2) {
                this.growable = false
                return true;
            }
        }
        return false;
    }

    getDistFromDot(dot) {
        return this.p5.dist(this.x, this.y, dot.x, dot.y)
    }

    update() {
        if (this.checkCanvasEdge()) {}
        else { this.grow() };
    }

    show() {
        this.p5.ellipseMode(this.p5.CENTER)
        if (this.outline) {
            this.p5.noFill();
            this.p5.stroke(255, 255, 255)
        }
        this.p5.circle(this.x, this.y, this.diameter)
    }

}

export default Dot;