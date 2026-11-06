'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserProfile extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      UserProfile.belongsTo(models.User,{
        foreignKey: 'userId',
        as: "user"
      })

    }
  }
  UserProfile.init({
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    avatar: DataTypes.TEXT,
    bio: DataTypes.TEXT,
    phone: DataTypes.STRING,
    date_of_birth: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'UserProfile',
  });
  return UserProfile;
};
