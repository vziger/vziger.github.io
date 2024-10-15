let mybutton

function ready() {
    mybutton = document.getElementById("btn-back-to-top");
    window.onscroll = function () {
      show_scroll_button(mybutton);
      };

      mybutton.addEventListener("click", back_to_top);
}