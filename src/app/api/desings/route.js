// app/api/designs/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { elements, customerEmail, type } = body;

    // 1. LÓGICA DE PERSISTENCIA (Guardado del diseño)
    // Aquí es donde normalmente harías: 
    // const savedDesign = await db.collection('designs').insertOne({ elements, customerEmail, createdAt: new Date() });
    console.log("Estructura visual recibida:", elements);

    // 2. LÓGICA DE NEGOCIO / CHECKOUT (Si el usuario hizo clic en Pagar)
    if (type === "CHECKOUT") {
      // Generamos un ID de orden único para producción
      const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Simulación de integración con pasarela (Stripe / Mercado Pago)
      // En producción, aquí llamarías al SDK de la pasarela para obtener un init_point o session_url
      const paymentUrl = `https://checkout.simulado.com/pay/${orderId}`;

      console.log(`[ORDEN CREADA] ID: ${orderId} para el cliente: ${customerEmail}`);

      return NextResponse.json({
        success: true,
        message: "Orden de pago generada exitosamente",
        orderId,
        paymentUrl,
        designId: Date.now()
      });
    }

    // 3. RESPUESTA PARA GUARDADO SIMPLE
    return NextResponse.json({ 
      success: true, 
      message: "Diseño guardado correctamente en el servidor",
      designId: Date.now() 
    });

  } catch (error) {
    console.error("Error en la ruta de diseños:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Error al procesar la solicitud" 
    }, { status: 500 });
  }
}
