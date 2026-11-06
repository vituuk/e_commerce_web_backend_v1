const fs=require("fs");
const path=require("path");
const dotenv=require("dotenv");
const bcrypt=require("bcrypt");
const jwt=require("jsonwebtoken");
const {User,Role,UserProfile}=require("../../models");
const AppError=require("../util/app-error");

const JWT_SECRET=process.env.JWT_SECRET || "sala-express";

const isPlaceholderClientId=(val)=>{
    if(!val || typeof val!=="string") return true;
    const trimmed=val.trim();
    if(!trimmed) return true;
    if(trimmed.startsWith("your-google-client-id") || trimmed.startsWith("YOUR_GOOGLE_CLIENT_ID")) return true;
    if(trimmed.startsWith("GOCSPX-")) return true;
    if(!trimmed.endsWith(".apps.googleusercontent.com")) return true;
    return false;
};

const getGoogleClientId=()=>{
    try{
        const envPath=path.resolve(__dirname,"../../.env");
        if(fs.existsSync(envPath)){
            const parsed=dotenv.parse(fs.readFileSync(envPath,"utf8"));
            if(!isPlaceholderClientId(parsed.GOOGLE_CLIENT_ID)){
                process.env.GOOGLE_CLIENT_ID=parsed.GOOGLE_CLIENT_ID.trim();
                return process.env.GOOGLE_CLIENT_ID;
            }
        }
    }
    catch(_){
        // fall back to process.env below
    }
    if(!isPlaceholderClientId(process.env.GOOGLE_CLIENT_ID)){
        return process.env.GOOGLE_CLIENT_ID.trim();
    }
    return "";
};

// create an account with the given role codes
// allowBodyRoles: if true, body.roles (array of role codes) overrides the default roleCodes
const register=async(body,roleCodes,allowBodyRoles=false)=>{
    const {firstName,lastName,email,password,status}=body;
    if(!email || !password) throw new AppError(400,"Email and password are required");

    let codes=roleCodes;
    if(allowBodyRoles && body.roles!==undefined){
        if(!Array.isArray(body.roles) || body.roles.length===0){
            throw new AppError(400,"roles must be a non-empty array of role codes");
        }
        codes=[...new Set(body.roles)];
    }
    const roles=await Role.findAll({where:{code:codes,status:true}});
    if(roles.length!==codes.length){
        const found=roles.map(r=>r.code);
        const error=new AppError(400,"Invalid role(s)");
        error.extra={invalid:codes.filter(c=>!found.includes(c))};
        throw error;
    }
    const existing=await User.findOne({where:{email}});
    if(existing) throw new AppError(409,"Email already registered");

    const hashedPassword=await bcrypt.hash(password,10);
    const user=await User.create({firstName,lastName,email,password:hashedPassword,status});
    await user.addRoles(roles);

    const {password:_,...userData}=user.toJSON();
    return {...userData,roles:roles.map(r=>r.code)};
};

// if requiredRole is given, account must have it (when requiredRole === "admin", allow "admin" or "superadmin")
const login=async(body,requiredRole)=>{
    const {email,password}=body;
    if(!email || !password) throw new AppError(400,"Email and password are required");

    const user=await User.findOne({
        where:{email},
        include:[{model:Role,attributes:["code"],through:{attributes:[]}}]
    });
    if(!user) throw new AppError(404,"Email user not found");
    if(!user.password){
        throw new AppError(401,"This account uses Google Sign-In. Please click 'Log in with Google'.");
    }

    const isMatch=await bcrypt.compare(password,user.password);
    if(!isMatch) throw new AppError(401,"Invalid password");

    const roles=(user.Roles || []).map(r=>r.code);
    if(requiredRole){
        const hasRequiredRole=requiredRole==="admin"
            ? (roles.includes("admin") || roles.includes("superadmin"))
            : roles.includes(requiredRole);
        if(!hasRequiredRole){
            throw new AppError(
                403,
                requiredRole==="admin"
                    ? "Access denied: Only admin or superadmin accounts can sign in here"
                    : `This account is not ${requiredRole}`
            );
        }
    }
    const expiresIn=requiredRole==="admin" ? "2h" : "1d";
    const token=jwt.sign({
        id:user.id,
        email:user.email,
        fullName:user.firstName + " " + user.lastName,
        roles
    },JWT_SECRET,{expiresIn});
    return {token,roles,expiresIn};
};

// all users without passwords
const listUsers=()=>User.findAll({
    attributes:{exclude:["password"]},
    include:[{model:Role,attributes:["code","name"],through:{attributes:[]}}],
    order:[["id","ASC"]]
});

// update user by ID (admin)
const updateUser=async(id,body={})=>{
    const user=await User.findByPk(id);
    if(!user) throw new AppError(404,"User not found");

    const firstName=body.firstName!==undefined ? body.firstName : body.firstname;
    const lastName=body.lastName!==undefined ? body.lastName : body.lastname;
    const {email,password,status}=body;

    if(email && email!==user.email){
        const existing=await User.findOne({where:{email}});
        if(existing) throw new AppError(409,"Email already registered");
        user.email=String(email).trim();
    }
    if(firstName!==undefined) user.firstName=typeof firstName==="string" ? firstName.trim() : firstName;
    if(lastName!==undefined) user.lastName=typeof lastName==="string" ? lastName.trim() : lastName;
    if(status!==undefined) user.status=Boolean(status);

    if(password && typeof password==="string" && !password.startsWith("$2b$") && !password.includes("•")){
        user.password=await bcrypt.hash(password,10);
    }

    await user.save();
    const {password:_,...userData}=user.toJSON();
    return userData;
};

// delete user by ID (admin)
const removeUser=async(id)=>{
    const user=await User.findByPk(id);
    if(!user) throw new AppError(404,"User not found");
    await user.destroy();
};

// verify Google OAuth2 accessToken or OIDC idToken and sign/register customer
const verifyGooglePayload=async({accessToken,idToken,credential},clientId)=>{
    if(accessToken){
        const tokenInfoRes=await fetch(
            `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
        );
        if(!tokenInfoRes.ok){
            throw new AppError(401,"Invalid or expired Google access token");
        }
        const tokenInfo=await tokenInfoRes.json();
        const matchesClient=tokenInfo.aud===clientId || tokenInfo.azp===clientId;
        if(!matchesClient){
            throw new AppError(401,"Google token client ID mismatch. Please verify GOOGLE_CLIENT_ID.");
        }

        const userInfoRes=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{
            headers:{Authorization:`Bearer ${accessToken}`}
        });
        if(!userInfoRes.ok){
            throw new AppError(401,"Unable to retrieve Google account profile");
        }
        const profile=await userInfoRes.json();
        return {
            email:profile.email,
            emailVerified:profile.email_verified===true || String(profile.email_verified)==="true",
            givenName:profile.given_name,
            familyName:profile.family_name,
            name:profile.name,
            picture:profile.picture
        };
    }

    const rawIdToken=idToken || credential;
    if(rawIdToken){
        const idInfoRes=await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(rawIdToken)}`
        );
        if(!idInfoRes.ok){
            throw new AppError(401,"Invalid or expired Google ID token");
        }
        const payload=await idInfoRes.json();
        if(payload.aud!==clientId){
            throw new AppError(401,"Google ID token client ID mismatch. Please verify GOOGLE_CLIENT_ID.");
        }
        if(payload.iss!=="accounts.google.com" && payload.iss!=="https://accounts.google.com"){
            throw new AppError(401,"Invalid Google token issuer");
        }
        return {
            email:payload.email,
            emailVerified:payload.email_verified===true || String(payload.email_verified)==="true",
            givenName:payload.given_name,
            familyName:payload.family_name,
            name:payload.name,
            picture:payload.picture
        };
    }

    throw new AppError(400,"Google accessToken or idToken is required");
};

const googleLogin=async(body={})=>{
    const clientId=getGoogleClientId();
    if(!clientId){
        throw new AppError(
            500,
            "GOOGLE_CLIENT_ID is not configured in admin/.env. Please add GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com to admin/.env."
        );
    }

    const googleData=await verifyGooglePayload(body,clientId);
    const normalizedEmail=googleData.email ? String(googleData.email).trim().toLowerCase() : "";
    if(!normalizedEmail || !googleData.emailVerified){
        throw new AppError(401,"Verified Google email address is required");
    }

    let firstName=(googleData.givenName || "").trim();
    let lastName=(googleData.familyName || "").trim();
    if(!firstName && googleData.name){
        const parts=String(googleData.name).trim().split(/\s+/);
        firstName=parts[0] || "";
        if(!lastName && parts.length>1){
            lastName=parts.slice(1).join(" ");
        }
    }
    if(!firstName){
        firstName=normalizedEmail.split("@")[0] || "Customer";
    }
    const picture=googleData.picture ? String(googleData.picture).trim() : null;

    const [userRole]=await Role.findOrCreate({
        where:{code:"user"},
        defaults:{name:"User",status:true}
    });

    let user=await User.findOne({
        where:User.sequelize.where(
            User.sequelize.fn("LOWER",User.sequelize.col("User.email")),
            normalizedEmail
        ),
        include:[
            {model:Role,attributes:["code"],through:{attributes:[]}},
            {model:UserProfile,as:"profile"}
        ]
    });

    if(!user){
        user=await User.create({
            firstName,
            lastName,
            email:normalizedEmail,
            password:null,
            status:true
        });
        await user.addRoles([userRole]);

        if(picture){
            await UserProfile.sequelize
                .query('ALTER TABLE "UserProfiles" ALTER COLUMN "avatar" TYPE TEXT;')
                .catch(()=>{});
            await UserProfile.create({
                userId:user.id,
                avatar:picture,
                phone:null,
                bio:null,
                date_of_birth:null
            });
        }
    }
    else{
        if(user.status===false){
            throw new AppError(403,"This account has been deactivated");
        }

        let userChanged=false;
        if(!user.firstName && firstName){
            user.firstName=firstName;
            userChanged=true;
        }
        if(!user.lastName && lastName){
            user.lastName=lastName;
            userChanged=true;
        }
        if(userChanged){
            await user.save();
        }

        const existingRoleCodes=(user.Roles || []).map(r=>r.code);
        if(!existingRoleCodes.includes("user")){
            await user.addRoles([userRole]);
        }

        if(picture && (!user.profile || !user.profile.avatar)){
            await UserProfile.sequelize
                .query('ALTER TABLE "UserProfiles" ALTER COLUMN "avatar" TYPE TEXT;')
                .catch(()=>{});
            if(!user.profile){
                await UserProfile.create({
                    userId:user.id,
                    avatar:picture,
                    phone:null,
                    bio:null,
                    date_of_birth:null
                });
            }
            else{
                await UserProfile.update(
                    {avatar:picture},
                    {where:{userId:user.id}}
                );
            }
        }
    }

    // Reload clean user state with roles and profile
    const freshUser=await User.findByPk(user.id,{
        attributes:{exclude:["password"]},
        include:[
            {model:Role,attributes:["code","name"],through:{attributes:[]}},
            {model:UserProfile,as:"profile",attributes:{exclude:["userId"]}}
        ]
    });

    const roles=(freshUser.Roles || []).map(r=>r.code);
    const fullName=`${(freshUser.firstName || "").trim()} ${(freshUser.lastName || "").trim()}`.trim() || freshUser.email;
    const expiresIn="1d";
    const token=jwt.sign({
        id:freshUser.id,
        email:freshUser.email,
        fullName,
        roles
    },JWT_SECRET,{expiresIn});

    return {
        token,
        roles,
        expiresIn,
        user:{
            id:freshUser.id,
            email:freshUser.email,
            firstName:freshUser.firstName,
            lastName:freshUser.lastName,
            fullName,
            roles,
            avatar:freshUser.profile ? freshUser.profile.avatar : null,
            profile:freshUser.profile || null
        }
    };
};

module.exports={register,login,googleLogin,getGoogleClientId,listUsers,updateUser,removeUser};
