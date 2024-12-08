import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const execAsync = promisify(exec);

interface VersionChange {
    version: string;
    type: 'major' | 'minor' | 'patch';
}

async function incrementVersion(): Promise<VersionChange> {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version.split('.').map(Number);
    const newVersion = [...currentVersion];
    
    // Determine which part to increment based on command line args
    const arg = process.argv[2] || 'patch';
    let type: 'major' | 'minor' | 'patch' = 'patch';
    
    switch (arg) {
        case 'major':
            newVersion[0]++;
            newVersion[1] = 0;
            newVersion[2] = 0;
            type = 'major';
            break;
        case 'minor':
            newVersion[1]++;
            newVersion[2] = 0;
            type = 'minor';
            break;
        default:
            newVersion[2]++;
            type = 'patch';
    }
    
    const version = newVersion.join('.');
    packageJson.version = version;
    
    // Update publisher from environment variable
    if (process.env.VSCODE_PUBLISHER_ID) {
        packageJson.publisher = process.env.VSCODE_PUBLISHER_ID;
    }
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    return { version, type };
}

async function cleanDirectories() {
    const outDir = path.join(__dirname, '..', 'out');
    const distDir = path.join(__dirname, '..', 'dist');
    
    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true });
    }
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true });
    }
}

async function installDependencies() {
    console.log('Installing dependencies...');
    await execAsync('npm install');
}

async function compileTypeScript() {
    console.log('Compiling TypeScript...');
    const extensionTsConfig = path.join(__dirname, '..', 'tsconfig.json');
    await execAsync(`npx tsc -p "${extensionTsConfig}"`);
}

async function packageExtension() {
    console.log('Packaging extension...');
    
    // Set VSCE_PAT environment variable for the package command
    const env = { ...process.env };
    if (process.env.VSCE_PAT) {
        env.VSCE_PAT = process.env.VSCE_PAT;
    }
    
    await execAsync('npx vsce package', { env });
}

async function publishExtension() {
    console.log('Publishing extension...');
    
    // Set VSCE_PAT environment variable for the publish command
    const env = { ...process.env };
    if (process.env.VSCE_PAT) {
        env.VSCE_PAT = process.env.VSCE_PAT;
    } else {
        throw new Error('VSCE_PAT environment variable is required for publishing');
    }
    
    await execAsync('npx vsce publish', { env });
}

async function deploy() {
    try {
        // Validate environment variables
        if (!process.env.VSCODE_PUBLISHER_ID) {
            throw new Error('VSCODE_PUBLISHER_ID environment variable is required');
        }

        // 1. Increment version
        const versionInfo = await incrementVersion();
        console.log(`Incremented version to ${versionInfo.version} (${versionInfo.type})`);

        // 2. Clean directories
        console.log('Cleaned output directories');
        await cleanDirectories();

        // 3. Install dependencies
        await installDependencies();
        console.log('Dependencies installed');

        // 4. Compile TypeScript
        await compileTypeScript();
        console.log('TypeScript compilation successful');

        // 5. Package extension
        await packageExtension();
        console.log('Extension packaged successfully');

        // 6. Publish extension only for minor or major version changes
        if ((versionInfo.type === 'minor' || versionInfo.type === 'major') && process.env.VSCE_PAT) {
            console.log(`Publishing ${versionInfo.type} version update...`);
            await publishExtension();
            console.log('Extension published successfully');
        } else if (versionInfo.type === 'patch') {
            console.log('Patch version update - skipping publish');
        } else if (!process.env.VSCE_PAT) {
            console.log('VSCE_PAT not found - skipping publish');
        }

        console.log('Deployment completed successfully!');
    } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
    }
}

// Run the deployment
deploy();
