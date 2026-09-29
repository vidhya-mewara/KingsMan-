document.addEventListener("DOMContentLoaded", () => {

    const slides = document.querySelectorAll(".promotion-slide");
    const dots = document.querySelectorAll(".promotion-dot");

    const prevButton = document.querySelector(".promotion-prev");
    const nextButton = document.querySelector(".promotion-next");

    if (slides.length <= 1) {
        return;
    }


    let currentSlide = 0;
    let autoPlay;


    function showSlide(index) {

        if (index >= slides.length) {
            index = 0;
        }

        if (index < 0) {
            index = slides.length - 1;
        }


        slides.forEach((slide, i) => {

            slide.classList.toggle(
                "active",
                i === index
            );

        });


        dots.forEach((dot, i) => {

            dot.classList.toggle(
                "active",
                i === index
            );

        });


        currentSlide = index;

    }


    function nextSlide() {

        showSlide(currentSlide + 1);

    }


    function previousSlide() {

        showSlide(currentSlide - 1);

    }


    function startAutoPlay() {

        clearInterval(autoPlay);

        autoPlay = setInterval(() => {

            nextSlide();

        }, 5000);

    }


    nextButton?.addEventListener("click", () => {

        nextSlide();

        startAutoPlay();

    });


    prevButton?.addEventListener("click", () => {

        previousSlide();

        startAutoPlay();

    });


    dots.forEach((dot, index) => {

        dot.addEventListener("click", () => {

            showSlide(index);

            startAutoPlay();

        });

    });


    const slider = document.querySelector(".promotion-slider");


    slider?.addEventListener("mouseenter", () => {

        clearInterval(autoPlay);

    });


    slider?.addEventListener("mouseleave", () => {

        startAutoPlay();

    });


    /* MOBILE SWIPE */

    let touchStartX = 0;


    slider?.addEventListener(
        "touchstart",
        (event) => {

            touchStartX =
                event.changedTouches[0].screenX;

        },
        { passive: true }
    );


    slider?.addEventListener(
        "touchend",
        (event) => {

            const touchEndX =
                event.changedTouches[0].screenX;

            const difference =
                touchStartX - touchEndX;


            if (Math.abs(difference) > 50) {

                if (difference > 0) {

                    nextSlide();

                } else {

                    previousSlide();

                }

                startAutoPlay();

            }

        },
        { passive: true }
    );


    showSlide(0);

    startAutoPlay();

});