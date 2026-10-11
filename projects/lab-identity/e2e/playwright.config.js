import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',workers:1,timeout:60000,expect:{timeout:10000},reporter:'list',use:{baseURL:'https://identity.lab.test',ignoreHTTPSErrors:true,screenshot:'only-on-failure'}});
