import { UserService } from "./../services/UserService";
import { Controller, Get, UseGuards, Put, Logger, Req, Body, Post } from "@nestjs/common";
import { Request } from "@nestjs/common";
import { UserInfoDTO } from "../models/user";
import { AddressModel } from "../models/address";
import { AddressService } from "../services/AdressesService";
import { JwtAuthGuard } from "../rules/JwtAuthGuard";
import { ApiConsumes, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";

@Controller("user")
export class UserController {
  constructor(
    private readonly UserService: UserService,
    private readonly addressService: AddressService,
  ) {}

  private readonly logger = new Logger("UserController");

  @ApiOperation({
    summary: "Obtém as informações do usuário logado.",
    description:
      "Retorna os dados completos do usuário autenticado, incluindo suas informações pessoais e endereços cadastrados. Requer token de autenticação válido.",
  })
  @ApiConsumes("application/json")
  @ApiResponse({
    status: 200,
    description: "Informações do usuário obtidas com sucesso.",
  })
  @ApiResponse({
    status: 401,
    description: "Não autorizado: Token de autenticação inválido ou expirado.",
  })
  @ApiResponse({ status: 404, description: "Usuário não encontrado." })
  @ApiResponse({ status: 500, description: "Erro interno do servidor." })
  @UseGuards(JwtAuthGuard)
  @Get("get-info")
  async getInfo(@Request() req: any) {
    const userInfo = await this.UserService.getUserInfo(req.user.id);
    const addresses = await this.addressService.getAddresses(req.user.id);

    return { ...userInfo, addresses: addresses };
  }

  @ApiOperation({
    summary: "Atualiza as informações do usuário logado.",
    description:
      "Atualiza os dados do usuário autenticado com as informações fornecidas no corpo da requisição. Requer token de autenticação válido.",
  })
  @ApiConsumes("application/json")
  @ApiResponse({
    status: 200,
    description: "Informações do usuário atualizadas com sucesso.",
  })
  @ApiResponse({
    status: 401,
    description: "Não autorizado: Token de autenticação inválido ou expirado.",
  })
  @ApiResponse({ status: 409, description: "Conflito: Email já cadastrado." })
  @ApiResponse({ status: 500, description: "Erro interno do servidor." })
  @ApiBody({ type: UserInfoDTO })
  @UseGuards(JwtAuthGuard)
  @Put("update-info")
  updateInfo(@Body() userInfoDTO: UserInfoDTO, @Req() req: any) {
    const userId = req.user.id;
    return this.UserService.updateUserInfo(userId, userInfoDTO);
  }

  @ApiOperation({
    summary: "Cadastra um novo endereço para um usuário.",
    description:
      "Cadastra um novo endereço vinculado ao usuário autenticado, armazenando informações de localização e configuração de endereço principal quando aplicável. Requer token de autenticação válido.",
  })
  @ApiConsumes("application/json")
  @ApiResponse({ status: 200, description: "Endereço cadastrado com sucesso." })
  @ApiResponse({
    status: 401,
    description: "Não autorizado: Token de autenticação inválido ou expirado.",
  })
  @ApiResponse({ status: 500, description: "Erro interno do servidor." })
  @ApiBody({ type: AddressModel })
  @UseGuards(JwtAuthGuard)
  @Post("create-address")
  createAddress(@Body() addressDTO: AddressModel, @Req() req: any) {
    const userId = req.user.id;
    return this.addressService.createAddress(userId, addressDTO);
  }

  @ApiOperation({
    summary: "Verifica se o usuário tem acesso válido.",
    description:
      "Verifica se o usuário autenticado tem acesso válido ao sistema. Requer token de autenticação válido.",
  })
  @ApiConsumes("application/json")
  @ApiResponse({
    status: 200,
    description: "Acesso válido verificado com sucesso.",
  })
  @ApiResponse({
    status: 401,
    description: "Não autorizado: Token de autenticação inválido ou expirado.",
  })
  @ApiResponse({ status: 500, description: "Erro interno do servidor." })
  @UseGuards(JwtAuthGuard)
  @Get("valid-access")
  validAccess(@Req() req: any) {
    return { valid: !!req.user };
  }
}
