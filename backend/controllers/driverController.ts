import { Driver } from '../services/driverService';
import { generateToken, decodeBearer } from '../services/cookieService';
import type { BunRequest } from 'bun';
import { validate } from '../utils/validate';
import { driverLoginSchema } from '../validations/driverValidations';

export const handleDriverLogin = async (req: BunRequest) => {
    const result = await validate(driverLoginSchema, req);
    if (!result.ok) return result.response;
    const { email, password } = result.data;

    const driver = await Driver.findByEmail(email);
    if (!driver) return Response.json({ success: false, error: 'Invalid credentials' }, { status: 401 });

    const isValid = await Bun.password.verify(password, driver.passwordHash);
    if (!isValid) return Response.json({ success: false, error: 'Invalid credentials' }, { status: 401 });

    const token = await generateToken(driver.id, driver.email, driver.username);
    return Response.json({ success: true, token, driver: { id: driver.id, username: driver.username, email: driver.email } });
};

export const handleDriverGetMe = async (req: BunRequest) => {
    const driver = await decodeBearer(req);
    if (!driver) return Response.json({ success: false, authenticated: false }, { status: 401 });
    return Response.json({ success: true, authenticated: true, driver });
};
