import { Controller, Get, Res, Req, Next } from "@nestjs/common";
import { join } from "path";
import { Response, Request, NextFunction } from "express";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
import rateLimit from "express-rate-limit";

const serveFrontendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 100, // Limita cada IP a 100 requests por janela
  message: "Muitas requisições, tente novamente mais tarde",
});

@Controller()
export class AppController {
  @ApiOperation({
    summary: "Serve o Frontend SPA",
  })
  @ApiResponse({
    status: 200,
    description: "Frontend SPA servido com sucesso",
  })
  @ApiResponse({
    status: 404,
    description: "Frontend SPA não encontrado",
  })
  @Get([":category", ":category/:productName"])
  public serveFrontend(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    serveFrontendLimiter(req, res, (err: any) => {
      if (err) return next(err);

      // Se o caminho contém um ponto (arquivo) ou começa com prefixos de API, pula para o próximo handler.
      const isApi =
        req.path.startsWith("/public") ||
        req.path.startsWith("/auth") ||
        req.path.startsWith("/user");

      if (req.path.includes(".") || isApi) {
        return next();
      }

      // Caminho absoluto para o seu arquivo de entrada do Angular
      const indexFile = join(process.cwd(), "client", "browser", "index.csr.html");
      return res.sendFile(indexFile);
    });
  }
}
