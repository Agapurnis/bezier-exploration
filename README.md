# [Bézier Curve Playground](https://www.roblox.com/games/18999429595/B-zier-Curve-Playground)

A Roblox game that allows for the generation and manipulation of 3D Bézier curves with many steps and control points.

Highly optimized; bottlenecked only by Roblox's ability to relocate and color parts.

## Features
- Usage of Parallel Luau; adjustable thread count
- Computation reduction: only compute derivatives where needed by visualization configuration
- Intuitive 3D manipulation mechanics
- Multiple methods of step generation:
  - Polynomial Evaluation
  - Polynomial Evaluation via [Horner's Method](https://en.wikipedia.org/wiki/Horner%27s_method)
  - [De Casteljau](https://en.wikipedia.org/wiki/De_Casteljau's_algorithm); ⚠️ currently broken
- Compute length of a curve via an adaptive [Guass-Legendre quadrature](https://en.wikipedia.org/wiki/Gauss%E2%80%93Legendre_quadrature); ⚠️ implementation may be incorrect
- Trace curve across time to see use in animation
- Configurable visual appearance
  - Transparency
  - Variation: visualize using steps of cubes, spheres, cylinders, or wedges
  - Size: option to use heuristic to resize parts to stretch across their span at low step counts; increases visual quality at slight performance cost
  - Color points based on:
    - [Curvature](https://en.wikipedia.org/wiki/Curvature#In_terms_of_a_general_parametrization)
    - Direction ([X, Y, Z] => [R, G, B])
    - Velocity (unit magnitude => green-red gradient)
    - Acceleration (unit magnitude => green-red gradient)
    - Randomly (can help visualize how much computation is being performed every step)
    - Without Color (results in performance boost by removing a step on Roblox's end)

## Approach

### Polynomial Coefficients

The polynomial bernstein coefficients are computed by getting the `n`th Pascal's tetrahedron layer, where `n` is the degree of the polynomial (how many control points there are).

I actually don't have the required mathematical knowledge to explain how this works, but I noticed this pattern on my own when [Freya Holmér had the coefficients of various derivations laid out nearby](https://youtu.be/aVwxzDHniEw?t=532).

To me, the velocity instantly jumped out as reminding me of Pascal's triangle, and through some brute force, I managed to find out it had to do with the layer of the tetrahedron.

After then also figuring out the power rule, it's easy to compute the coefficients needed for any level of derivatives.

I suspect there's a better approach to achieving this, but it was quite fun to do and in practice doesn't have any performance impact because Roblox's ability to update parts is what is bottlenecking the code.
One exception is that since the coefficient tables are cached in each thread for every degree, memory usage can be moderately impacted.

## TODO
- Review implementation of integration for length computation
- Improve UI
 - Visual composition
 - Synchronize changes when default values based off of another one are changed
 <!--
   The thread count defaults to a number based on the current resolution.
	 If the resolution changes, the thread count will change if it hasn't been explicitly set by the user.
	 However, this will not be reflected on the UI, and there isn't any way to go back to the original behavior afterwards.
	 This is not ideal.
	-->s
