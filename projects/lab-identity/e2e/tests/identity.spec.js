import { test, expect } from '@playwright/test';
async function login(page,username,password) {
 await page.goto('/');await page.getByRole('link',{name:'Sign in',exact:true}).click();
 await page.locator('#username').fill(username);await page.locator('#password').fill(password);await page.locator('#kc-login').click();
 await expect(page.getByRole('heading',{name:'Your workspace'})).toBeVisible();
}
test('member gets catalogue and profile but cannot administer users',async({page})=>{
 await login(page,'user1@mail.com','user1');
 await expect(page.getByRole('button',{name:'Users & access'})).toHaveCount(0);
 expect((await page.request.get('/api/v1/admin/users')).status()).toBe(403);
 await expect(page.getByRole('heading',{name:'Hero Association',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'My profile',exact:true}).click();
 await expect(page.locator('input[name="email"]')).toHaveValue('user1@mail.com');
 const response=await page.request.put('/api/v1/profile',{data:{email:'user1@mail.com',firstName:'User1',lastName:'Last1'}});
 expect(response.status()).toBe(400);
 await page.getByRole('link',{name:/Manage password and account security/}).click();
 await expect(page.getByRole('heading',{name:'Personal info',exact:true})).toBeVisible();
});
test('administrator sees application grants and reuses SSO in Hero',async({page})=>{
 await login(page,'lab-admin','lab-admin');
 await page.getByRole('button',{name:'Users & access',exact:true}).click();
 await page.getByRole('button',{name:/^user3@mail.com/}).click();
 await expect(page.getByRole('heading',{name:'Application access',exact:true})).toBeVisible();
 await expect(page.getByLabel('Hero Association',{exact:false})).toBeChecked();
 await page.goto('https://heroassociation.test/');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL('https://heroassociation.test/');
 expect((await (await page.request.get('https://heroassociation.test/api/v1/session')).json()).authenticated).toBe(true);
 expect((await page.request.get('https://heroassociation.test/api/v1/account')).status()).toBe(200);
});
