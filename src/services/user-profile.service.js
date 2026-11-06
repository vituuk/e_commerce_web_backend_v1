const { User, Role, UserProfile } = require("../../models");
const AppError = require("../util/app-error");

// user (no password) + profile + roles
const findUserProfile = async (id) => {
    const user = await User.findByPk(id, {
        attributes: { exclude: ["password"] },
        include: [
            { model: UserProfile, as: "profile", attributes: { exclude: ["userId"] } },
            { model: Role, attributes: ["code", "name"], through: { attributes: [] } }
        ]
    });
    if (!user) throw new AppError(404, "User not found");
    return user;
};

const findUser = async (id) => {
    const user = await User.findByPk(id);
    if (!user) throw new AppError(404, "User not found");
    return user;
};

const validate = (body) => {
    // Keep validation lightweight and resilient so profile updates (avatar, names) are never blocked
    const date_of_birth = body.date_of_birth !== undefined ? body.date_of_birth : (body.dateOfBirth !== undefined ? body.dateOfBirth : body.dob);
    if (date_of_birth !== undefined && date_of_birth !== null && String(date_of_birth).trim() !== "") {
        const parsed = Date.parse(date_of_birth);
        if (isNaN(parsed)) {
            // invalid date will be safely converted to null in saveProfile without throwing 400
        }
    }
};

// firstName / lastName are on the Users table - supports camelCase (lastName), lowercase (lastname), and snake_case (last_name)
const saveNames = async (userId, body) => {
    const userUpdates = {};

    const rawFirst = body.firstName !== undefined ? body.firstName : (body.firstname !== undefined ? body.firstname : body.first_name);
    if (rawFirst !== undefined) {
        userUpdates.firstName = typeof rawFirst === "string" ? rawFirst.trim() : (rawFirst ?? null);
    }

    const rawLast = body.lastName !== undefined ? body.lastName : (body.lastname !== undefined ? body.lastname : body.last_name);
    if (rawLast !== undefined) {
        userUpdates.lastName = typeof rawLast === "string" ? rawLast.trim() : (rawLast ?? null);
    }

    if (Object.keys(userUpdates).length > 0) {
        await User.update(userUpdates, { where: { id: userId } });
    }
};

// Upsert profile (create or update seamlessly)
const saveProfile = async (userId, body) => {
    const user = await findUser(userId);
    validate(body);

    // 1. Update firstName / lastName directly in the Users table
    await saveNames(user.id, body);

    // 2. Update profile fields in the UserProfiles table
    const avatar = body.avatar !== undefined ? body.avatar : body.avatarUrl;
    const bio = body.bio;
    const phone = body.phone !== undefined ? body.phone : body.phoneNumber;
    const date_of_birth = body.date_of_birth !== undefined ? body.date_of_birth : (body.dateOfBirth !== undefined ? body.dateOfBirth : body.dob);

    let cleanAvatar = undefined;
    if (avatar !== undefined) {
        const raw = avatar ? String(avatar).trim() : '';
        if (raw.includes('@') && !raw.includes('/')) {
            cleanAvatar = null;
        } else {
            cleanAvatar = raw || null;
        }
    }
    const cleanBio = bio !== undefined ? (typeof bio === "string" ? bio.trim() : (bio ?? null)) : undefined;
    
    let cleanPhone = undefined;
    if (phone !== undefined) {
        if (phone && String(phone).trim() && !String(phone).includes("@")) {
            const rawClean = String(phone).replace(/[\s()\-.]/g, "").trim();
            if (/^\+?[0-9]{6,15}$/.test(rawClean)) {
                cleanPhone = rawClean;
            } else {
                cleanPhone = null;
            }
        } else {
            cleanPhone = null;
        }
    }
    
    let cleanDob = undefined;
    if (date_of_birth !== undefined) {
        if (date_of_birth && String(date_of_birth).trim() !== "") {
            const parsed = new Date(date_of_birth);
            cleanDob = isNaN(parsed.getTime()) ? null : parsed;
        } else {
            cleanDob = null;
        }
    }

    await UserProfile.sequelize.query('ALTER TABLE "UserProfiles" ALTER COLUMN "avatar" TYPE TEXT;').catch(() => {});

    let profile = await UserProfile.findOne({ where: { userId: user.id } });

    if (!profile) {
        await UserProfile.create({
            userId: user.id,
            avatar: cleanAvatar !== undefined ? cleanAvatar : null,
            bio: cleanBio !== undefined ? cleanBio : null,
            phone: cleanPhone !== undefined ? cleanPhone : null,
            date_of_birth: cleanDob !== undefined ? cleanDob : null
        });
    } else {
        const profileUpdates = {};
        if (cleanAvatar !== undefined) profileUpdates.avatar = cleanAvatar;
        if (cleanBio !== undefined) profileUpdates.bio = cleanBio;
        if (cleanPhone !== undefined) profileUpdates.phone = cleanPhone;
        if (cleanDob !== undefined) profileUpdates.date_of_birth = cleanDob;
        if (Object.keys(profileUpdates).length > 0) {
            await UserProfile.update(profileUpdates, { where: { userId: user.id } });
        }
    }

    return findUserProfile(user.id);
};

// POST /auth/profile : create or update seamlessly
const create = async (userId, body) => {
    return saveProfile(userId, body);
};

// PUT /auth/profile : update or create seamlessly
const update = async (userId, body) => {
    return saveProfile(userId, body);
};

// DELETE /auth/profile/:userId (admin)
const remove = async (userId) => {
    const profile = await UserProfile.findOne({ where: { userId } });
    if (!profile) {
        // Also allow deleting by UserProfile primary key id if passed
        const byPk = await UserProfile.findByPk(userId);
        if (!byPk) throw new AppError(404, "User profile not found");
        await byPk.destroy();
        return;
    }
    await profile.destroy();
};

module.exports = { findUserProfile, create, update, remove };
