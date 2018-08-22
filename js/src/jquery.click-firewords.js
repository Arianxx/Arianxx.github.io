(function ($) {
    $.fn.clickFireworks = function (params) {
        params = $.extend({
            id: 'fireworks',
            zIndex: 1000,
            appendTo: 'body',
        }, params);

        $(this).css({
            'position': 'relative',
            'z-index': params.zIndex + 1
        });

        return this.on('click', function (e) {
            // html
            {
                let s = `<canvas
                        id="${params.id}"
                        style="position: fixed;
                        width: 100%;
                        height: 100%;
                        left: 0;
                        top: 0;
                        z-index: ${params.zIndex};
                        background-color: transparent;">
                     </canvas>`;
                $(params.appendTo).append(s);
            }

            let canvasEl = $(`#${params.id}`).get(0);
            let ctx = canvasEl.getContext('2d');
            let numberOfParticles = 30;
            let colors = ['#FF1461', '#18FF92', '#5A87FF', '#FBF38C'];

            let setParticleDirection = function (p) {
                let angle = anime.random(0, 360) * Math.PI / 180;
                let value = anime.random(50, 180);
                let radius = [-1, 1][anime.random(0, 1)] * value;
                return {
                    x: p.x + radius * Math.cos(angle),
                    y: p.y + radius * Math.sin(angle)
                }
            };
            let createParticle = function (x, y) {
                let p = {};
                p.x = x;
                p.y = y;
                p.color = colors[anime.random(0, colors.length - 1)];
                p.radius = anime.random(16, 32);
                p.endPos = setParticleDirection(p);
                p.draw = function () {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
                    ctx.fillStyle = p.color;
                    ctx.fill();
                };
                return p;
            };
            let createCircle = function (x, y) {
                let p = {};
                p.x = x;
                p.y = y;
                p.color = '#FFF';
                p.radius = 0.1;
                p.alpha = .5;
                p.lineWidth = 6;
                p.draw = function () {
                    ctx.globalAlpha = p.alpha;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI, true);
                    ctx.lineWidth = p.lineWidth;
                    ctx.strokeStyle = p.color;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                };
                return p;
            };
            let renderParticle = function (anim) {
                for (let i = 0; i < anim.animatables.length; i++) {
                    anim.animatables[i].target.draw();
                }
            };
            let animateParticles = function (x, y) {
                let circle = createCircle(x, y);
                let particles = [];
                for (let i = 0; i < numberOfParticles; i++) {
                    particles.push(createParticle(x, y));
                }
                anime.timeline().add({
                    targets: particles,
                    x: function (p) {
                        return p.endPos.x;
                    },
                    y: function (p) {
                        return p.endPos.y;
                    },
                    radius: 0.1,
                    duration: anime.random(1200, 1800),
                    easing: 'easeOutExpo',
                    update: renderParticle
                })
                    .add({
                        targets: circle,
                        radius: anime.random(80, 160),
                        lineWidth: 0,
                        alpha: {
                            value: 0,
                            easing: 'linear',
                            duration: anime.random(600, 800),
                        },
                        duration: anime.random(1200, 1800),
                        easing: 'easeOutExpo',
                        update: renderParticle,
                        offset: 0
                    });
            };

            let render = anime({
                duration: 500,
                update: function () {
                    // clear canvas on every frame
                    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                },
                complete: function () {
                    canvasEl.remove();
                }
            });

            render.play();
            animateParticles(e.clientX, e.clientY);

            // canvas size
            {
                function setCanvasSize() {
                    canvasEl.width = window.innerWidth * 2;
                    canvasEl.height = window.innerHeight * 2;
                    canvasEl.style.width = window.innerWidth + 'px';
                    canvasEl.style.height = window.innerHeight + 'px';
                    canvasEl.getContext('2d').scale(2, 2);
                }

                setCanvasSize();
                window.addEventListener('resize', setCanvasSize);
            }
        });
    }
}(jQuery));