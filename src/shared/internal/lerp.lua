--!native
local module = {}
function module.glerp(a, b, t)
    return a + (b - a) * t
end
function module.flerp(a, b, t)
    return (1 - t) * a + t * b
end
return module
