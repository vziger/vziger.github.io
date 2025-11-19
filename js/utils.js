const compare_numbers = (a, b) => a - b
const compare_arrays = (a, b) =>
    a.length === b.length &&
    a.every((element, index) => element === b[index]);

const rearange_by_pos = function(a, b){
    let atop  = a.style.top;
    let aleft = a.style.left;
    let btop  = b.style.top;
    let bleft = b.style.left;
    atop = atop.substring(0, atop.length - 2)
    aleft = aleft.substring(0, aleft.length - 2)
    btop = btop.substring(0, btop.length - 2)
    bleft = bleft.substring(0, bleft.length - 2)

    if(aleft == bleft && atop == btop) return 0;
    else {
        if(atop < btop) return -1
        else if( atop > btop) return 1;
        else { // same
            if(aleft < bleft) return -1;
            else return 1;
        }
    }
}


function seconds_to_time(total_seconds) {
    const hours   = Math.floor(total_seconds / 3600)
    const remains = total_seconds % 3600;
    const minutes = Math.floor(remains / 60);
    const seconds = remains % 60;

    let time_to_show = ''

    time_to_show += hours > 0 ? hours.toString().padStart(2, '0') + ':' : ''
    time_to_show += minutes.toString().padStart(2, '0') + ':'
    time_to_show += seconds.toString().padStart(2, '0')

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


function multiply_gorbov_array(arr, mult) {
    a = arr.slice()
    a.forEach((item) => {
        item.digit *= mult
    } )
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


function get_hex_color(element, style_color_property) {
    const computed_style = getComputedStyle(element)
    const rgb = computed_style[style_color_property].match(/\d+/g)

    const r = parseInt(rgb[0]).toString(16).padStart(2, '0')
    const g = parseInt(rgb[1]).toString(16).padStart(2, '0')
    const b = parseInt(rgb[2]).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
}


function kanzas_city_shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}


function set_asterisks_into_cells() {
    const cells = document.querySelectorAll('.cell')
    cells.forEach(cell => {
        cell.textContent = '*';
        cell.style.paddingTop = 'var(--asterisk-shift-pdt)';
    })
}


function display_hide_containers(list_elements, show_hide_flag) {
    for (let j = 0; j < list_elements.length ; j++) {
        list_elements[j].style.display = show_hide_flag
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

function draw(dom_element, progress) {
    dom_element.style.left = progress * coords[0] + "px";
    dom_element.style.top  = progress * coords[1] + "px";
}
// ********************************************************


function insert_nav() {
    fetch('navigation.html', { mode: 'no-cors' })
    .then(response => response.text())
    .then(navigation => document.getElementById('navbar').innerHTML = navigation);
}


function show_scroll_button(mybutton) {
    if (
      document.body.scrollTop > 200 ||
      document.documentElement.scrollTop > 200
    ) {
      mybutton.style.display = "block";
    } else {
      mybutton.style.display = "none";
    }
}


function back_to_top() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
}


function set_pos_dom_element(el, position, left, top){
    if(position) el.style.position = position
    el.style.left =`${left}px`
    el.style.top = `${top}px`
}


function get_property_int_value(el, property) {
    let res = getComputedStyle(el, null).getPropertyValue(property)
    return +res.substring(0, res.length - 2)
}


// function check_velocity_input(velocity_value){
//     let res = (velocity_value != "" && !Number.isNaN(velocity_value))
//     if (res) {
//         res = Number(velocity_value) > 0 && Number(velocity_value) < 11
//     }
//     console.log('check_velocity_input =', res)
//     return res
// }

function check_velocity_input(velocity_value) {
  const num = Number(velocity_value)
  return !isNaN(num) && num > 0 && num < 11
}


// Струп, hands and letters, mental arithmetic
function make_delays_array(start, step, size) {
    return Array.from({ length: size }, (_, index) => start + index * step).reverse()
}

function get_random_int(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function capitalize_first_letter(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str
}

function cut_from_char(str, char) {
    const index = str.indexOf(char)
    return index === -1 ? str : str.slice(0, index)
}

function set_event_listener_escape_fullscreen_mode(dom_element, callback_func){
    document.addEventListener('keyup', function(event) {
        if (event.code == 'Escape') {
            event.preventDefault()
            if (dom_element.style.getPropertyValue('position') == 'absolute'){
                callback_func()
            }
        }
    })
}

function agree_word_with_number(number, word = 'слово') {
    const num = Math.floor(Math.abs(number))

    const last_digit = num % 10;
    const last_two_digits = num % 100;

    let form

    if (last_two_digits >= 11 && last_two_digits <= 19) {
        form = 'слов'
    }
    else if (last_digit === 1) {
        form = 'слово'
    }
    else if (last_digit >= 2 && last_digit <= 4) {
        form = 'слова'
    }
    else {
        form = 'слов';
    }
    return `${num} ${form}`;
}

// Струп, hands and letters, mental arithmetic
function set_event_listeners_to_change_velocity_buttons(dom_element__name, input_velocity_node){
    const btns = document.getElementsByName(dom_element__name)
    for (let j = 0; j < btns.length ; j++) {
        btns[j].addEventListener('click', function(){
            let dv = +this.getAttribute('data-change')
            let velocity_value = Number(input_velocity_node.value)
            if ((velocity_value > 1 && dv < 0) ||
                (velocity_value < 10 && dv > 0)
            ){
                input_velocity_node.value = dv + velocity_value
            }
        })
    }
}

// Струп, hands and letters
function make_yellow_contrast(node, color) {
    node.style.textShadow = color === '#FFC247' ? '.5px .5px #C58D00' : ''
}

function make_text_white(node, color) {
    node.style.color = color === '#FFC247' ? 'white' : 'antiquewhite'
}

// Струп, hands and letters, mental arithmetic
function resize_playground(make_bigger, exercise_box) {
    if(make_bigger) {
        const navbar_node      = document.getElementById('navbar')
        const navbar_container = document.getElementById('navbar_container')
        const navbar_btn       = document.getElementById('navbar_button')
        const ww = document.documentElement.clientWidth
        const hh = document.documentElement.clientHeight
        const menu_btn_width = Number(navbar_btn.offsetWidth)

        const pl = get_property_int_value(navbar_container, 'padding-left')
        const pt = get_property_int_value(navbar_node, 'padding-top')
        const new_sizes = calculate_expanded_sizes(ww, hh, menu_btn_width, pl, pt)

        set_pos_dom_element(exercise_box, 'absolute', new_sizes.left, new_sizes.top)
        exercise_box.style.width = `${new_sizes.width}px`
        exercise_box.style.height = `${new_sizes.height}px`
    }
    else {
        exercise_box.style.removeProperty('left')
        exercise_box.style.removeProperty('top')
        exercise_box.style.width  = 'var(--box-for-strup-size)'
        exercise_box.style.height =  'var(--box-for-strup-size)'
    }
}

function calculate_expanded_sizes(width, height, menu_btn_width, padding_left, padding_top) {
    return {
        left: menu_btn_width + 2 * padding_left,
        top: padding_top,
        width: width - menu_btn_width - 3 * padding_left,
        height: height - 2 * padding_top
    };
}

// Струп, hands and letters, mental arithmetic
function show_hide_lorem_colors(/*bool*/show) {
    const display_value = show == true ? 'block' : 'none'
    const lorem_colors  = document.getElementsByName('text-color')
    for (let i = lorem_colors.length - 1; i >= 0 ; --i) {
        lorem_colors[i].style.display = display_value
    }
}
