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


function empty_grid_cells_array(grid_cells_array) {
    for (let i = grid_cells_array.length - 1; i >= 0 ; --i) {
        grid_cells_array[i].remove()
    }
}


function generate_numbers_array(size) {
    let arr = new Array(size)
    for (let i = 0; i < size; i++) {
        arr[i] = i + 1
    }
    return arr
}


function generate_gorbov_array(size, color) {
    let arr = new Array(size)
    for (let i = 0; i < size; i++) {
        arr[i] = {digit: i+1, color: color}
    }
    return arr
}


function multiply_array(arr, mult) {
    a = arr.slice()
    a.forEach((item) => {
        item['digit'] = item['digit'] * mult;
    } );
    return a
    // return arr.map((x) => {digit: x['digit'] * mult, color: x['color']})
}


function concat_gorbov_red_and_black_arrays(red_arr, black_arr) {
    let arr = new Array(red_arr.length + black_arr.length)
    for (let i = 0; i < black_arr.length; i++) {
        arr[2 * i]     = red_arr[i]
        arr[2 * i + 1] = black_arr[i]
    }
    if (red_arr.length > black_arr.length) {
        arr[red_arr.length + black_arr.length - 1] = red_arr[red_arr.length - 1]
    }
    return arr
}


function componentToHex(comp) {
    return comp.length == 1 ? "0" + comp : comp;
}


function get_hex_color(element, styleColor) {
    let rgb
    if (styleColor == 'background-color') {
        rgb = getComputedStyle(element).backgroundColor.match(/\d+/g)
    }
    else if (styleColor == 'color') {
        rgb = getComputedStyle(element).color.match(/\d+/g)
    }

    r = parseInt(rgb[0]).toString(16)
    g = parseInt(rgb[1]).toString(16)
    b = parseInt(rgb[2]).toString(16)
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b)
}


function kanzas_city_shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}


function set_asterisks_into_cells() {
    let grid_cells = document.getElementsByClassName('cell')
    for (let i = grid_cells.length - 1; i >=0 ; --i) {
        grid_cells[i].innerHTML = '*'
        grid_cells[i].style.setProperty('padding-top', 'var(--asterisk-shift-pdt)')
    }
}


function display_hide_containers(list_elements, show_hide_flag) {
    for (let j = 0; j < list_elements.length ; j++) {
        list_elements[j].style.setProperty('display', show_hide_flag)
    }
}


function blink(cell) {
    cell.style.setProperty('background-color','var(--cell-blink-color)')
    setTimeout(function() {
        cell.style.setProperty('background-color','var(--cell-background-color)');
    }, 50)
}


// **** Анимация для бегающей точки ***********************
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
// ********************************************************


function insert_nav(){
    fetch('navigation.html', { mode: 'no-cors' })
    .then(response => response.text())
    .then(navigation => document.getElementById('navbar').innerHTML = navigation);
}


function scrollFunction(mybutton) {
    if (
      document.body.scrollTop > 200 ||
      document.documentElement.scrollTop > 200
    ) {
      mybutton.style.display = "block";
    } else {
      mybutton.style.display = "none";
    }
  }

  function backToTop() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }