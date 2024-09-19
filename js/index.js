let mybutton

function ready() {
    mybutton = document.getElementById("btn-back-to-top");
    window.onscroll = function () {
        scrollFunction(mybutton);
      };

      mybutton.addEventListener("click", backToTop);
}