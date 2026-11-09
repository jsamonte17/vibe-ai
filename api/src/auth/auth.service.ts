import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import { AuthPayload, AuthTokenPayload, AuthUser } from "./auth.types"

interface SmartHrResponse {
  StatusCode?: number | string
  Message?: string
  Result?: Record<string, unknown>
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
  ) {}

  async login(username: string, password: string): Promise<AuthPayload> {
    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password) {
      throw new UnauthorizedException("Username and password are required.")
    }

    const jwtSecret = this.requiredSetting("JWT_SECRET")
    const profileUrl = this.requiredSetting("VESPROFILE_URL").replace(
      /\/+$/,
      ""
    )
    const validation = await this.requestJson(
      `${profileUrl}/api/Authenticate/UserAccount`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Username: normalizedUsername,
          Password: password
        })
      }
    )

    const employeeNumberValue = validation.Result?.EmployeeNumber
    const employeeNumber =
      typeof employeeNumberValue === "string" ||
      typeof employeeNumberValue === "number"
        ? String(employeeNumberValue)
        : ""
    if (Number(validation.StatusCode) !== 3 || !employeeNumber) {
      throw new UnauthorizedException(
        validation.Message || "Invalid username or password."
      )
    }

    const profile = await this.getEmployeeProfile(employeeNumber)

    const empid = this.stringValue(profile.empid) || employeeNumber
    const user: AuthUser = {
      id: this.stringValue(profile.id) || empid,
      empid,
      username: this.stringValue(profile.username) || normalizedUsername,
      nickname: this.stringValue(profile.nickname),
      first_name: this.stringValue(profile.first_name),
      last_name: this.stringValue(profile.last_name),
      email: this.stringValue(profile.email)
    }

    return {
      accessToken: await this.jwtService.signAsync(
        {
          username: user.username,
          empid: user.empid
        },
        {
          secret: jwtSecret,
          subject: user.empid,
          expiresIn: this.tokenLifetimeSeconds(),
          algorithm: "HS256"
        }
      ),
      user
    }
  }

  async getEmployeeProfile(
    employeeNumber: string
  ): Promise<Record<string, unknown>> {
    const normalizedEmployeeNumber = employeeNumber.trim()
    if (!normalizedEmployeeNumber) {
      throw new UnauthorizedException("An employee number is required.")
    }

    const smartHrUrl = this.requiredSetting("SMARTHR_URL").replace(/\/+$/, "")
    const smartHrToken = this.requiredSetting("SMARTHR_TOKEN")
    const securityStamp = this.configService
      .get<string>("SMARTHR_SECURITY_TIMESTAMP")
      ?.trim()
    const profile = await this.requestJson(
      `${smartHrUrl}/api/Profile/Detail/${encodeURIComponent(normalizedEmployeeNumber)}`,
      {
        headers: {
          "Content-Type": "application/json",
          Token: smartHrToken,
          ...(securityStamp ? { SecurityStamp: securityStamp } : {})
        }
      }
    )
    if (Number(profile.StatusCode) === 0 || !profile.Result) {
      throw new UnauthorizedException("SmartHR returned no employee profile.")
    }

    return profile.Result
  }

  async verifyAccessToken(token: string): Promise<AuthTokenPayload> {
    const secret = this.requiredSetting("JWT_SECRET")
    let payload: AuthTokenPayload
    try {
      payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret,
        algorithms: ["HS256"]
      })
    } catch {
      throw new UnauthorizedException("Invalid or expired access token.")
    }

    if (
      typeof payload.sub !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.empid !== "string"
    ) {
      throw new UnauthorizedException("Invalid access token.")
    }

    return payload
  }

  private tokenLifetimeSeconds(): number {
    const lifetimeSeconds = Number(
      this.configService.get<string>("JWT_EXPIRES_IN_SECONDS") || 86400
    )
    if (!Number.isSafeInteger(lifetimeSeconds) || lifetimeSeconds <= 0) {
      throw new ServiceUnavailableException(
        "JWT_EXPIRES_IN_SECONDS must be a positive integer."
      )
    }
    return lifetimeSeconds
  }

  private async requestJson(
    url: string,
    init: RequestInit
  ): Promise<SmartHrResponse> {
    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(10000)
      })
    } catch {
      throw new ServiceUnavailableException(
        "Could not connect to the company authentication service."
      )
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        "The company authentication service returned an error."
      )
    }

    try {
      return (await response.json()) as SmartHrResponse
    } catch {
      throw new ServiceUnavailableException(
        "The company authentication service returned an invalid response."
      )
    }
  }

  private requiredSetting(name: string): string {
    const value = this.configService.get<string>(name)?.trim()
    if (!value) {
      throw new ServiceUnavailableException(
        `Authentication configuration ${name} is missing.`
      )
    }
    return value
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === "string" && value ? value : undefined
  }
}
