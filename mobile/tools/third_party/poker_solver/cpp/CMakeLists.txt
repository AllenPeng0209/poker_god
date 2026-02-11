cmake_minimum_required(VERSION 3.16)
project(river_solver_optimized LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

option(CFR_USE_DOUBLE "Use double-precision regret/strategy buffers" OFF)

add_executable(river_solver_optimized
    src/cards.cpp
    src/river_game.cpp
    src/vector_eval.cpp
    src/mccfr.cpp
    src/subgame_config.cpp
    src/trainer.cpp
    src/main.cpp
)

target_include_directories(river_solver_optimized PRIVATE src)
if(CFR_USE_DOUBLE)
    target_compile_definitions(river_solver_optimized PRIVATE CFR_USE_DOUBLE)
endif()

if(MSVC)
    target_compile_options(river_solver_optimized PRIVATE /O2 /DNDEBUG)
else()
    target_compile_options(river_solver_optimized PRIVATE -O3 -DNDEBUG -march=native -ffast-math -funroll-loops)
endif()
