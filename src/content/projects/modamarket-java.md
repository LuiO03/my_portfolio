---
title: ModaMarket POS Java

short_description: Sistema de Punto de Venta (POS) desarrollado en Java utilizando el patrón MVC para la gestión de ventas, productos e inventario.

description: |
  ModaMarket POS es un sistema de escritorio desarrollado en Java con arquitectura Modelo-Vista-Controlador (MVC), diseñado para optimizar las operaciones de un negocio dedicado a la venta de prendas de vestir.

  El proyecto permite gestionar productos, categorías, clientes y ventas mediante una interfaz intuitiva, facilitando el registro de transacciones, el control de inventario y la administración de la información almacenada en una base de datos relacional.

  La aplicación implementa una estructura organizada basada en el patrón MVC, promoviendo la separación de responsabilidades, el mantenimiento del código y la escalabilidad del sistema. Además, incorpora validaciones de datos, consultas seguras y una interfaz enfocada en agilizar el proceso de venta.

  Este proyecto demuestra conocimientos en desarrollo de aplicaciones de escritorio con Java, programación orientada a objetos, arquitectura MVC, acceso a bases de datos y diseño de sistemas para entornos comerciales.

logo: /images/projects/modamarket-pos/logo.png

github: https://github.com/LuiO03/POS-ModaMarket-Java

demo: ""

content: |
  ## Descripción General

  ModaMarket POS es un sistema de punto de venta desarrollado para apoyar la gestión operativa de una tienda de ropa, permitiendo registrar ventas de manera rápida, administrar el inventario y mantener organizada la información del negocio.

  El sistema fue diseñado con una arquitectura MVC para separar la lógica de negocio, la interfaz gráfica y el acceso a los datos, facilitando futuras mejoras y el mantenimiento del proyecto.

  ## Características Principales

  - Registro de ventas.
  - Gestión de productos.
  - Administración de categorías.
  - Gestión de clientes.
  - Control de inventario.
  - Cálculo automático del total de compra.
  - Actualización automática del stock.
  - Validación de datos.
  - Arquitectura MVC.
  - Programación Orientada a Objetos.
  - Interfaz gráfica intuitiva.
  - Organización modular del código.

  ## Módulos Implementados

  ### Gestión de Productos

  Permite registrar, modificar, eliminar y consultar productos disponibles para la venta, manteniendo información como nombre, precio, categoría y cantidad en inventario.

  ### Gestión de Categorías

  Facilita la clasificación de los productos mediante categorías, mejorando la organización y la administración del catálogo.

  ### Gestión de Clientes

  Permite registrar y consultar información de los clientes para asociarla a las ventas realizadas.

  ### Punto de Venta

  Es el módulo principal del sistema, donde se seleccionan los productos, se calculan automáticamente los importes de la compra y se registra la venta.

  Durante el proceso se realizan acciones como:

  - Agregar productos al detalle de venta.
  - Calcular subtotales y total.
  - Validar disponibilidad de stock.
  - Registrar la transacción.
  - Actualizar el inventario automáticamente.

  ### Gestión de Inventario

  Permite controlar la disponibilidad de productos y mantener actualizado el stock después de cada operación de venta.

  ## Aspectos Técnicos Destacados

  - Desarrollo utilizando Java.
  - Arquitectura Modelo-Vista-Controlador (MVC).
  - Programación Orientada a Objetos (POO).
  - Acceso a base de datos mediante JDBC.
  - Uso de consultas preparadas (PreparedStatement).
  - Organización modular del código.
  - Validación de entradas de usuario.
  - Separación entre lógica de negocio, interfaz y acceso a datos.
  - Manejo de excepciones para mejorar la estabilidad del sistema.

  ## Objetivos del Proyecto

  - Automatizar el proceso de ventas de una tienda de ropa.
  - Aplicar el patrón de arquitectura MVC.
  - Implementar principios de Programación Orientada a Objetos.
  - Desarrollar una solución organizada y escalable.
  - Gestionar productos, clientes, ventas e inventario desde una única aplicación.
  - Simular un sistema POS cercano a un entorno comercial real.

technologies:
  - name: Java
    icon: simple-icons:coffeescript

  - name: MySQL
    icon: simple-icons:mysql

  - name: JDBC
    icon: tabler:database

  - name: Swing
    icon: tabler:app-window

  - name: Git
    icon: simple-icons:git
---