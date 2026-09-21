document.addEventListener("DOMContentLoaded", () => {
    const slides = document.querySelectorAll(".slide");
    const dots = document.querySelectorAll(".dot");

    const nextBtn = document.querySelector(".slider-arrow.next");
    const prevBtn = document.querySelector(".slider-arrow.prev");

    // No slider or only one image
    if (slides.length <= 1) {
        return;
    }

    let currentSlide = 0;
    let autoSlide;

    // Show selected slide
    function showSlide(index) {
        // Loop to first slide
        if (index >= slides.length) {
            currentSlide = 0;
        }

        // Loop to last slide
        else if (index < 0) {
            currentSlide = slides.length - 1;
        }

        else {
            currentSlide = index;
        }

        // Activate slide
        slides.forEach((slide, i) => {
            slide.classList.toggle(
                "active",
                i === currentSlide
            );
        });

        // Activate dot
        dots.forEach((dot, i) => {
            dot.classList.toggle(
                "active",
                i === currentSlide
            );
        });
    }

    // Next image
    function nextSlide() {
        showSlide(currentSlide + 1);
    }

    // Previous image
    function previousSlide() {
        showSlide(currentSlide - 1);
    }

    // NEXT button
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            nextSlide();

            // Restart automatic timer
            startAutoSlide();
        });
    }

    // PREVIOUS button
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            previousSlide();

            // Restart automatic timer
            startAutoSlide();
        });
    }

    // Dot buttons
    dots.forEach((dot, index) => {
        dot.addEventListener("click", () => {
            showSlide(index);

            // Restart automatic timer
            startAutoSlide();
        });
    });

    // Automatic slider
    function startAutoSlide() {
        clearInterval(autoSlide);

        autoSlide = setInterval(() => {
            nextSlide();
        }, 4000);
    }

    // Start slider
    showSlide(0);
    startAutoSlide();
});