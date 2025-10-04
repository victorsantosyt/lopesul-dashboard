import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

import prisma from '@/lib/prisma';

export async function DELETE(req, { params }) {
  const id = parseInt(params.id);

  try {
    await prisma.dispositivo.delete({ where: { id } });
    return NextResponse.json({ message: "Dispositivo removido com sucesso." });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao remover dispositivo." }, { status: 500 });
  }
}
