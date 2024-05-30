
function seconds_to_time(total_seconds) {
    let hours   = Math.floor(total_seconds / 3600)
    let minutes = Math.floor((total_seconds - (hours * 3600)) / 60)
    let seconds = total_seconds - (hours * 3600) - (minutes * 60)

    seconds = Math.round(seconds * 100) / 100

    let time_to_show = ''
    if (hours != 0) {
        time_to_show += hours + ':'
    }
    time_to_show += (minutes < 10 ? '0' + minutes : minutes)
    time_to_show += ':' + (seconds  < 10 ? '0' + seconds : seconds)
    return time_to_show
}


function display_hide_containers(list_elements, show_hide_flag) {
    for (let j = 0; j < list_elements.length ; j++) {
        list_elements[j].style.setProperty('display', show_hide_flag)
    }
}


function animate({timing, draw, duration}) {
    let start = performance.now();

    requestAnimationFrame(function animate(time) {
        // timeFraction от 0 до 1
        let timeFraction = (time - start) / duration;
        if (timeFraction > 1) timeFraction = 1;
        
        // текущее состояние анимации
        let progress = timing(timeFraction)
        draw(progress);
        
        if (timeFraction < 1) {
            requestAnimationFrame(animate);
        }
    });
}

function draw(dom_element, progress){
    dom_element.style.left = progress * coords[0] + "px";
    dom_element.style.top  = progress * coords[1] + "px";
}


function insert_nav(){
    fetch('navigation.html', { mode: 'no-cors' })
    .then(response => response.text())
    .then(navigation => document.getElementById('navbar').innerHTML = navigation);
}