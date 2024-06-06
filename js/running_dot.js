const DIRECTION_HORIZONTAL = 1 
const DIRECTION_VERTICAL   = 2
const DIRECTION_DIAGONAL_1 = 3
const DIRECTION_DIAGONAL_2 = 4
const DIRECTION_INFINITY   = 5
const DIRECTION_CHAOS      = 6

const VELOCITY = [2, 4, 8]

let running_dot
let box_for_dot
let box_background
let box_size
let dot_size

let lemniskate_x
let lemniskate_y
let lemniskate_index = 0

let input_velocity

let fullscreen_text_container
let full_screen_checkbox

let btn_start
let btn_stop

let exercise_timer_id
let timer_node

let all_switchers_container
let start_stop_container
let results_container
let error_text_node

let prev_direction
let dot_current_coords = [0, 0]
let velocity = 1
let exercise_interval_id = 0

let canvas
let ctx

let root_doc


function ready() {
    root_doc = document.documentElement;

    running_dot    = document.getElementById('running_dot')
    box_for_dot    = document.getElementById('box_for_dot')
    box_background = document.getElementById('box_background')
    canvas         = document.getElementById('draw_line')

    box_size = getComputedStyle(root_doc, null).getPropertyValue('--box-for-dot-size')
    box_size = +box_size.substring(0, box_size.length - 2)
    
    dot_size = getComputedStyle(root_doc, null).getPropertyValue('--dot-size')
    dot_size = +dot_size.substring(0, dot_size.length - 2)

    prev_direction = +document.querySelector('input[type="radio"][name="btnradio-direction"]:checked').getAttribute('data-direction')
    set_initial_position(prev_direction)

    generate_lemniskate(2)

    input_velocity = document.getElementById('input_velocity')

    fullscreen_text_container = document.getElementById('fullscreen_text_container')
    full_screen_checkbox      = document.getElementById('fullscreen_checkbox')

    timer_node = document.getElementById('exercise_timer')
    btn_start  = document.getElementById('start_button')
    btn_stop   = document.getElementById('stop_button')

    all_switchers_container = document.getElementsByClassName('all-switchers-container-diag')
    results_container       = document.getElementsByClassName('results-container')
    start_stop_container    = document.getElementById('start_stop_container')

    error_text_node = document.getElementById('switchers_error')

    set_event_listeners_to_direction_radios()
    set_event_listeners_to_change_velocity_buttons()
    set_event_listener_escape_fullscreen_mode()

    fullscreen_text_container.addEventListener('click', function(){
        full_screen_checkbox.checked = !full_screen_checkbox.checked
    })

    draw_line(DIRECTION_DIAGONAL_1)
}


function draw_line(direction){
    ctx = canvas.getContext('2d')
    let a = dot_size/2
    let x0, y0, x1, y1

    switch(direction) {
        case DIRECTION_HORIZONTAL:
            x0 = a
            y0 = box_size/2
            x1 = box_size - a
            y1 = box_size/2
            break;
        case DIRECTION_VERTICAL:
            x0 = box_size/2
            y0 = a
            x1 = box_size/2
            y1 = box_size - a
            break;
        case DIRECTION_DIAGONAL_1:
            x0 = a
            y0 = a
            x1 = box_size - a
            y1 = box_size - a
            break;
        case DIRECTION_DIAGONAL_2:
            x0 = box_size - a
            y0 = a
            x1 = a
            y1 = box_size - a
            break;
    }

    // координаты начала линии X,Y
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)

    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = '1'
    ctx.setLineDash([10, 5])
    // ctx.stroke() // обводка линии
}


function clear_canvas(){
    ctx = canvas.getContext('2d')
    // TODO: не работает
    // Заливаем все пространство холста цветом фона
    // ctx.fillStyle = '#ffffff'; // белый цвет
    // ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}


function set_event_listeners_to_direction_radios() {
    const radios = document.getElementsByName('btnradio-direction')
    for (let j = 0; j < radios.length ; j++) {
        radios[j].addEventListener('click', function(){
            direction = +this.getAttribute('data-direction')
            clear_canvas()
            set_initial_position(direction)
        })
    }
}


function set_event_listeners_to_change_velocity_buttons(){
    const btns = document.getElementsByName('btn-change-velocity')
    for (let j = 0; j < btns.length ; j++) {
        btns[j].addEventListener('click', function(){
            dv = +this.getAttribute('data-change')
            if ((Number(input_velocity.value) > 1 && dv < 0) || (Number(input_velocity.value) < 10 && dv > 0)){
                input_velocity.value = dv + Number(input_velocity.value)
                velocity = Number(input_velocity.value)
                console.log(input_velocity.value)
            }
        })
    }
}

function set_event_listener_escape_fullscreen_mode(){
    document.addEventListener('keyup', function(event) {
        if (event.code == 'Escape') {
            event.preventDefault();
            let box_position_property = box_for_dot.style.getPropertyValue('position')
            if (box_position_property == 'absolute'){
                stop_running()
            }
            console.log(box_for_dot.style.getPropertyValue('position'))
        }
    });
}


function set_initial_position(direction){
    switch(direction) {
        case DIRECTION_HORIZONTAL:
            draw_line(DIRECTION_HORIZONTAL)
            set_position([0, (box_size - dot_size)/2])
            break;
        case DIRECTION_VERTICAL:
            draw_line(DIRECTION_VERTICAL)
            set_position([(box_size - dot_size)/2, 0])
            break;
        case DIRECTION_DIAGONAL_1:
            draw_line(DIRECTION_DIAGONAL_1)
            set_position([0, 0])
            break;
        case DIRECTION_DIAGONAL_2:
            draw_line(DIRECTION_DIAGONAL_2)
            set_position([box_size - dot_size, 0])
            break;
        case DIRECTION_INFINITY:
            set_position([lemniskate_x[0], lemniskate_y[0]])
            break;
        case DIRECTION_CHAOS:
            set_position([0, 0])
            animate_figure()
            break;
    }
}


function make_new_position(x_direction, y_direction){
    const x = dot_current_coords[0] + x_direction * velocity;
    const y = dot_current_coords[1] + y_direction * velocity;
    return [x, y];    
}


function generate_lemniskate(velocity){
    let qqq = (box_size - dot_size)/2

    let lemniskate_a   = Math.floor((box_size - dot_size)/2/Math.sqrt(2))
    let lemniskate_a2  = lemniskate_a ** 2
    let lemniskate_4a2 = 4 * lemniskate_a ** 2
    let lemniskate_a4  = lemniskate_a ** 4
    
    let x_arr_left = [- Math.floor(qqq)]
    let x_arr_right = [Math.floor(qqq)]
    
    let y_arr_left = [0]
    let y_arr_right = [0]
    
    let k = box_size/2
    
    lemniskate_x = []
    lemniskate_y = []
    for (let i = - Math.floor(qqq) + velocity; i < 0; i = i + velocity){
        x_arr_left.push(i)
        x_arr_right.unshift(-i)
        
        y = Math.round(Math.sqrt(Math.sqrt(lemniskate_a4 + lemniskate_4a2 * (i ** 2)) - i ** 2 - lemniskate_a2))
        y_arr_left.push(y)
        y_arr_right.unshift(-y)
    }

    lemniskate_y = x_arr_left.concat(0, x_arr_right.slice(), x_arr_right.slice().reverse(), 0, x_arr_left.slice().reverse())
    lemniskate_x = y_arr_left.concat(0, y_arr_right.slice(), y_arr_left.slice(), 0, y_arr_right.slice())
    
    for (let i = 0; i < lemniskate_x.length; i++){
        let a = lemniskate_x[i]
        // lemniskate_x[i] = k - lemniskate_y[i] - dot_size/2
        // lemniskate_y[i] = k + a - dot_size/2
        lemniskate_x[i] = k + lemniskate_y[i] - dot_size/2
        lemniskate_y[i] = k - a - dot_size/2
    }

    // console.log(lemniskate_x)
    // console.log(lemniskate_y)
    // plot_lemniskate()
}


function plot_lemniskate(){
    let divElem
    for (let i = 0; i < lemniskate_x.length; i++){
        divElem = document.createElement('div');
        divElem.setAttribute('class', 'temp-dots')
        divElem.style.setProperty('left', lemniskate_x[i] + 'px')
        divElem.style.setProperty('top', lemniskate_y[i] + 'px')
        box_for_dot.append(divElem);
    }
}


function update_position_lemniskate(){
    set_position([lemniskate_x[lemniskate_index], lemniskate_y[lemniskate_index]])
    lemniskate_index = (lemniskate_index == lemniskate_x.length) ? 0 : lemniskate_index + 1
}


function update_position(x_direction, y_direction) {
    set_position(make_new_position(x_direction, y_direction))

    // Проверяем, попал ли шар в верхнюю или нижнюю часть контейнера и меняем направление движения
    if (check_outside_boundaries()) {
        velocity = -velocity;
    }
}


function check_outside_boundaries() {
    const delta = box_size - dot_size
    return (dot_current_coords[0] <= 0 || dot_current_coords[1] <= 0 || dot_current_coords[0] >= delta || dot_current_coords[1] >= delta)
}


function set_position(coords) {
    dot_current_coords = coords.slice()
    running_dot.style.left = coords[0] + "px";
    running_dot.style.top = coords[1] + "px";
}


function init_state() {
    timer_node.style.setProperty('visibility', 'visible')

    error_text_node.style.setProperty('visibility', 'hidden')

    btn_start.style.setProperty('display', 'none')
    btn_stop.style.setProperty('display', 'block')

    display_hide_containers(all_switchers_container, 'none')
    display_hide_containers(results_container, 'block')

    timer_node.innerHTML = '00:00'
}

function set_pos_dom_element(el, position, left, top){
    el.style.setProperty('position', position)
    el.style.setProperty('left', left + 'px')
    el.style.setProperty('top', top + 'px')
}

function resize_box(make_bigger){
    if(make_bigger){
        box_background.style.setProperty('display', 'block')
        start_stop_container.style.setProperty('position', 'absolute')

        let ww = document.documentElement.clientWidth
        let hh = document.documentElement.clientHeight
        let mm = Math.min(ww, hh) - dot_size

        set_pos_dom_element(box_for_dot, 'absolute', (ww - mm)/2, (hh - mm)/2)
        set_pos_dom_element(timer_node, 'absolute', (ww + mm)/2 + dot_size, (hh - mm)/2)
        timer_node.style.setProperty('line-height', '36px')

        set_pos_dom_element(btn_stop, 'fixed', (ww + mm)/2 + dot_size - 10, (hh + mm)/2 - btn_stop.offsetHeight)
        btn_stop.style.setProperty('width', '280px')

        box_size = mm
        root_doc.style.setProperty('--box-for-dot-size', mm + 'px')    
    }
    else{
        box_background.style.setProperty('display', 'none')
        start_stop_container.style.setProperty('position', 'relative')

        box_for_dot.style.setProperty('position', 'relative')
        box_for_dot.style.removeProperty('left')
        box_for_dot.style.removeProperty('top')

        timer_node.style.setProperty('position', 'relative')
        timer_node.style.removeProperty('left')
        timer_node.style.removeProperty('top')
        timer_node.style.removeProperty('line-height')

        btn_stop.style.setProperty('position', 'relative')
        btn_stop.style.removeProperty('left')
        btn_stop.style.removeProperty('top')
        btn_stop.style.removeProperty('width')

        box_size = 608
        root_doc.style.setProperty('--box-for-dot-size', 608 + 'px')
    }
}


function check_velocity_input(){
    a = input_velocity.value
    b = (a!= "" && !Number.isNaN(a))
    console.log(b)
    return b
}


function start_running() {
    if(check_velocity_input()){
        const DIRECTION_SELECTED = +document.querySelector('input[type="radio"][name="btnradio-direction"]:checked').getAttribute('data-direction')
        // const VELOCITY_SELECTED  = +document.querySelector('input[type="radio"][name="btnradio-velocity"]:checked').getAttribute('data-velocity')
        const VELOCITY_SELECTED = Number(input_velocity.value)
        velocity = VELOCITY_SELECTED

        init_state()

        let timer_seconds = 0
        exercise_timer_id = setInterval(exercise_timer_func, 1000)

        // velosity_sign = (DIRECTION_SELECTED == prev_direction) ? Math.sign(velocity) : 1
        // velocity = velosity_sign * VELOCITY_SELECTED
        // prev_direction = DIRECTION_SELECTED

        if(full_screen_checkbox.checked){
            resize_box(true)
        }

        set_initial_position(DIRECTION_SELECTED)
        
        
        switch (DIRECTION_SELECTED) {
            case DIRECTION_HORIZONTAL:
                exercise_interval_id = setInterval(update_position, 5, 1, 0);
                // animate({
                //     duration: 100,
                //     timing: function(timeFraction) {
                //     return timeFraction;
                //     },
                //     draw: function(progress) {
                //         running_dot.style.left = progress * (box_size - dot_size) + "px";
                //         // running_dot.style.top  = progress * 600 + "px";
                //     }
                // });
                break;
            case DIRECTION_VERTICAL:
                exercise_interval_id = setInterval(update_position, 5, 0, 1);
                break;
            case DIRECTION_DIAGONAL_1:
                exercise_interval_id = setInterval(update_position, 5, 1, 1);
                break;
            case DIRECTION_DIAGONAL_2:
                exercise_interval_id = setInterval(update_position, 5, -1, 1);
                break;
            case DIRECTION_INFINITY:
                generate_lemniskate(VELOCITY_SELECTED)
                console.log('Длина лемнискаты')
                console.log(lemniskate_x.length)
                lemniskate_index = 0
                exercise_interval_id = setInterval(update_position_lemniskate, 5)
                break;
        }

        function exercise_timer_func() {
            timer_seconds++;
            timer_node.innerHTML = seconds_to_time(timer_seconds)
        }
    }
    else{
        error_text_node.innerHTML = 'Задайте скорость от 1 до 10'
        error_text_node.style.setProperty('visibility', 'visible')
    }
}


function stop_running(){
    if (exercise_interval_id) {
        clearTimeout(exercise_interval_id);
        exercise_interval_id = 0;
    }

    clearInterval(exercise_timer_id);

    display_hide_containers(all_switchers_container, 'block');
    display_hide_containers(results_container, 'none');

    btn_stop.style.setProperty('display', 'none');
    btn_start.style.setProperty('display', 'block');

    resize_box(false)

    const DIRECTION_SELECTED = +document.querySelector('input[type="radio"][name="btnradio-direction"]:checked').getAttribute('data-direction')
    set_initial_position(DIRECTION_SELECTED)
    velocity = Math.abs(velocity)
}





// ******************************************************************************************
function animate_figure(){
    const new_pos = make_new_position(1, 1);
    console.log(new_pos)
    console.log(dot_current_coords)
    let speed = get_new_speed([dot_current_coords[0], dot_current_coords[1]], new_pos);
    console.log(speed)
    update_position()
    // $('.a').animate({ top: new_pos[0], left: new_pos[1] }, speed, function(){
    //     animate_figure();        
    // });
    
};

function get_new_speed(prev, next) {
    let x = Math.abs(prev[0] - next[0])
    let y = Math.abs(prev[1] - next[1])
    
    const greatest = x > y ? x : y
    const speed_mult = 0.1

    return Math.ceil(greatest/speed_mult)
}